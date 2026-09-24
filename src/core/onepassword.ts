import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { errors } from "../utils/errors";
import { exec, execWithStdin } from "../utils/shell";
import { removeTempFile, trackTempFile } from "../utils/temp-files";
import {
    type CreateItemOptions,
    type CreateItemResult,
    type EditItemOptions,
    type SecretType,
    toSecretType,
} from "./types";

interface VerboseOption {
    verbose?: boolean;
}

/**
 * Check if the 1Password CLI is installed
 */
export async function checkOpCli(options: VerboseOption = {}): Promise<boolean> {
    const result = await exec("op", ["--version"], options);
    return result.exitCode === 0;
}

export type OpStatus = "missing" | "signed-out" | "ready";

/**
 * Find out in one `op` call whether the CLI is installed and signed in: a missing binary fails
 * to spawn, while an installed one that is signed out exits non-zero. Spawning op is slow under
 * WSL (op.exe), so this replaces a separate `op --version` probe.
 */
export async function getOpStatus(options: VerboseOption = {}): Promise<OpStatus> {
    const result = await exec("op", ["whoami", "--format", "json"], options);
    if (result.spawnError === "ENOENT") {
        return "missing";
    }
    return result.exitCode === 0 ? "ready" : "signed-out";
}

/**
 * Check if user is signed in to 1Password CLI
 */
export async function checkSignedIn(options: VerboseOption = {}): Promise<boolean> {
    const result = await exec("op", ["whoami", "--format", "json"], options);
    return result.exitCode === 0;
}

/**
 * Sign in to 1Password CLI (opens system auth dialog)
 */
export async function signIn(options: VerboseOption = {}): Promise<boolean> {
    const result = await exec("op", ["signin"], options);
    return result.exitCode === 0;
}

/**
 * Run an `op ... --format json` listing and parse it. A failed or unreadable listing throws
 * rather than reading as empty: "not found" would lead the caller to create a duplicate.
 */
async function listJson<T>(args: string[], action: string, options: VerboseOption): Promise<T[]> {
    const result = await exec("op", [...args, "--format", "json"], options);
    if (result.exitCode !== 0) {
        throw errors.opCommandFailed(action, result.stderr.trim() || `op exited with code ${result.exitCode}`);
    }
    try {
        return JSON.parse(result.stdout) as T[];
    } catch {
        throw errors.opCommandFailed(action, "op returned output that is not valid JSON");
    }
}

/**
 * Check if an item exists in a vault, return its ID if found
 *
 * @throws Env2OpError if the items cannot be listed
 */
export async function itemExists(vault: string, title: string, options: VerboseOption = {}): Promise<string | null> {
    const items = await listJson<{ id: string; title: string }>(
        ["item", "list", "--vault", vault],
        `list items in vault "${vault}"`,
        options,
    );
    return items.find((item) => item.title === title)?.id ?? null;
}

/**
 * Check if a vault exists
 *
 * @throws Env2OpError if the vaults cannot be listed
 */
export async function vaultExists(vault: string, options: VerboseOption = {}): Promise<boolean> {
    const vaults = await listJson<{ name: string }>(["vault", "list"], "list vaults", options);
    return vaults.some((v) => v.name === vault);
}

/**
 * Create a new vault
 */
export async function createVault(name: string, options: VerboseOption = {}): Promise<void> {
    const result = await exec("op", ["vault", "create", name], options);
    if (result.exitCode !== 0) {
        throw errors.vaultCreateFailed(result.stderr.trim() || `op exited with code ${result.exitCode}`);
    }
}

interface OpItemResult {
    id: string;
    title: string;
    vault?: { name: string; id: string };
    fields?: Array<{ label: string; id: string; type?: string }>;
}

let tempCounter = 0;

function writeTempTemplate(template: OpFieldsTemplate): string {
    const filePath = join(tmpdir(), `env2op-template-${process.pid}-${++tempCounter}.json`);
    // It holds every value in plain text, so keep it readable by the owner only, and make sure
    // it is deleted even when Ctrl-C ends the process before the `finally` that removes it
    trackTempFile(filePath);
    writeFileSync(filePath, JSON.stringify(template), { encoding: "utf-8", mode: 0o600 });
    return filePath;
}

function cleanupTempFile(filePath: string): void {
    removeTempFile(filePath);
}

interface OpFieldsTemplate {
    fields: Array<{
        type: "STRING" | "CONCEALED";
        label: string;
        value: string;
    }>;
}

/**
 * Words that mark a variable name as sensitive under `--secret=auto`. They are matched
 * against whole parts of the name (API_KEY is `api` + `key`, apiKey likewise), so `key`
 * catches API_KEY but not MONKEY, and `cert` catches TLS_CERT but not CERTAIN_FLAG.
 */
const SECRET_NAME_PARTS = new Set([
    "apikey",
    "cert",
    "certificate",
    "credential",
    "credentials",
    "dsn",
    "encryption",
    "jwt",
    "key",
    "keys",
    "pass",
    "passphrase",
    "passwd",
    "password",
    "pat",
    "private",
    "privatekey",
    "pwd",
    "salt",
    "secret",
    "secretkey",
    "secrets",
    "signature",
    "signing",
    "token",
    "tokens",
]);

/**
 * Longer words also caught at the end of a run-together part, as in ACCESSTOKEN or
 * CLIENTSECRET. Short words are left out: `key` would match MONKEY.
 */
const SECRET_NAME_SUFFIXES = ["token", "secret", "password", "passwd", "credential", "apikey"];

/** A URL carrying a password in its userinfo, as in postgres://user:pass@host/db */
const URL_WITH_PASSWORD = /^[a-z][a-z0-9+.-]*:\/\/[^\s/@:]*:[^\s/@]+@/i;

function nameLooksSecret(key: string): boolean {
    const parts = key
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter(Boolean);
    return parts.some(
        (part) => SECRET_NAME_PARTS.has(part) || SECRET_NAME_SUFFIXES.some((suffix) => part.endsWith(suffix)),
    );
}

/**
 * Decide whether a field is stored concealed (password) or visible (text).
 *
 * Under `auto`, a field is concealed when its name looks secret or its value is a URL with a
 * password in it, so DATABASE_URL=postgres://user:pass@host is hidden while
 * DATABASE_URL=postgres://localhost/app stays readable.
 */
export function determineFieldType(
    field: { key: string; value: string },
    secret: boolean | SecretType,
): "STRING" | "CONCEALED" {
    switch (toSecretType(secret)) {
        case "password":
            return "CONCEALED";
        case "auto":
            return nameLooksSecret(field.key) || URL_WITH_PASSWORD.test(field.value) ? "CONCEALED" : "STRING";
        default:
            return "STRING";
    }
}

/**
 * Build JSON template containing only fields for 1Password item.
 * Metadata (title, vault, category) is passed via CLI flags.
 */
function buildFieldsTemplate(
    fields: Array<{ key: string; value: string }>,
    secretOption: boolean | SecretType,
): OpFieldsTemplate {
    return {
        fields: fields.map(({ key, value }) => ({
            type: determineFieldType({ key, value }, secretOption),
            label: key,
            value,
        })),
    };
}

/**
 * Build a full item template (metadata + fields) to pipe via stdin.
 *
 * Fallback for the WSL → Windows `op.exe` shim: a Windows process spawned from
 * WSL never sees stdin as a TTY, so op.exe always concludes piped input is
 * present and refuses `--template`. Piping the whole template via stdin (no
 * `--template`) is the form op.exe accepts there — the pre-0.2.7 approach.
 */
function buildFullTemplate(
    title: string,
    vault: string,
    fields: Array<{ key: string; value: string }>,
    secretOption: boolean | SecretType,
): OpFieldsTemplate & { title: string; vault: { name: string }; category: string } {
    return {
        title,
        vault: { name: vault },
        category: "SECURE_NOTE",
        ...buildFieldsTemplate(fields, secretOption),
    };
}

/**
 * op refuses to combine `--template` with piped stdin. When op.exe (WSL) wrongly
 * believes stdin is piped, it emits this collision error even though we passed
 * none — our cue to retry by actually piping the template via stdin instead.
 */
function isTemplateStdinCollision(stderr: string): boolean {
    const s = stderr.toLowerCase();
    return s.includes("template") && (s.includes("stdin") || s.includes("piped input"));
}

/**
 * Parse `op item create/edit --format json` output into a CreateItemResult,
 * mapping each field's label to its 1Password field ID.
 */
function parseItemResult(stdout: string, vault: string): CreateItemResult {
    const item = JSON.parse(stdout) as OpItemResult;

    const fieldIds: Record<string, string> = {};
    for (const field of item.fields ?? []) {
        if (field.label && field.id) {
            fieldIds[field.label] = field.id;
        }
    }

    return {
        id: item.id,
        title: item.title,
        vault: item.vault?.name ?? vault,
        vaultId: item.vault?.id ?? "",
        fieldIds,
    };
}

/**
 * Create a Secure Note in 1Password with the given fields
 */
export async function createSecureNote(options: CreateItemOptions & VerboseOption): Promise<CreateItemResult> {
    const { vault, title, fields, secret, verbose } = options;

    const templatePath = writeTempTemplate(buildFieldsTemplate(fields, secret));

    try {
        let result = await exec(
            "op",
            [
                "item",
                "create",
                "--category",
                "Secure Note",
                "--title",
                title,
                "--vault",
                vault,
                "--template",
                templatePath,
                "--format",
                "json",
            ],
            // op echoes the item back with every field value
            { verbose, hideStdout: true },
        );

        // WSL → Windows op.exe always treats the spawned stdin as piped input
        // and rejects --template. Fall back to piping the full template via
        // stdin (no --template), which op.exe accepts.
        if (result.exitCode !== 0 && isTemplateStdinCollision(result.stderr)) {
            result = await execWithStdin("op", ["item", "create", "--format", "json"], {
                stdin: JSON.stringify(buildFullTemplate(title, vault, fields, secret)),
                verbose,
                hideStdout: true,
            });
        }

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || "Failed to create item");
        }

        return parseItemResult(result.stdout, vault);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw errors.itemCreateFailed(message);
    } finally {
        cleanupTempFile(templatePath);
    }
}

/**
 * Edit an existing Secure Note in 1Password - updates fields in place
 * This preserves the item UUID and doesn't add to trash
 * JSON piping completely replaces fields - no need for manual deletion
 */
export async function editSecureNote(options: EditItemOptions & VerboseOption): Promise<CreateItemResult> {
    const { vault, title, fields, secret, verbose, itemId } = options;

    const templatePath = writeTempTemplate(buildFieldsTemplate(fields, secret));

    try {
        let result = await exec(
            "op",
            [
                "item",
                "edit",
                itemId,
                "--title",
                title,
                "--vault",
                vault,
                "--template",
                templatePath,
                "--format",
                "json",
            ],
            // op echoes the item back with every field value
            { verbose, hideStdout: true },
        );

        // WSL → Windows op.exe always treats the spawned stdin as piped input
        // and rejects --template. Fall back to piping the full template via
        // stdin (no --template), which op.exe accepts.
        if (result.exitCode !== 0 && isTemplateStdinCollision(result.stderr)) {
            result = await execWithStdin("op", ["item", "edit", itemId, "--format", "json"], {
                stdin: JSON.stringify(buildFullTemplate(title, vault, fields, secret)),
                verbose,
                hideStdout: true,
            });
        }

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || "Failed to edit item");
        }

        return parseItemResult(result.stdout, vault);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw errors.itemEditFailed(message);
    } finally {
        cleanupTempFile(templatePath);
    }
}
