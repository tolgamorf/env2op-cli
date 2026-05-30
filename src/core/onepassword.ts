import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { errors } from "../utils/errors";
import { exec, execWithStdin } from "../utils/shell";
import type { CreateItemOptions, CreateItemResult, EditItemOptions } from "./types";

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
 * Check if an item exists in a vault, return its ID if found
 */
export async function itemExists(vault: string, title: string, options: VerboseOption = {}): Promise<string | null> {
    const result = await exec("op", ["item", "list", "--vault", vault, "--format", "json"], options);
    if (result.exitCode !== 0) {
        return null;
    }
    try {
        const items = JSON.parse(result.stdout) as Array<{ id: string; title: string }>;
        const item = items.find((item) => item.title === title);
        return item?.id ?? null;
    } catch {
        return null;
    }
}

/**
 * Check if a vault exists
 */
export async function vaultExists(vault: string, options: VerboseOption = {}): Promise<boolean> {
    const result = await exec("op", ["vault", "list", "--format", "json"], options);
    if (result.exitCode !== 0) {
        return false;
    }
    try {
        const vaults = JSON.parse(result.stdout) as Array<{ name: string }>;
        return vaults.some((v) => v.name === vault);
    } catch {
        return false;
    }
}

/**
 * Create a new vault
 */
export async function createVault(name: string, options: VerboseOption = {}): Promise<void> {
    try {
        await exec("op", ["vault", "create", name], options);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw errors.vaultCreateFailed(message);
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
    writeFileSync(filePath, JSON.stringify(template), "utf-8");
    return filePath;
}

function cleanupTempFile(filePath: string): void {
    try {
        unlinkSync(filePath);
    } catch {
        // ignore cleanup errors
    }
}

interface OpFieldsTemplate {
    fields: Array<{
        type: "STRING" | "CONCEALED";
        label: string;
        value: string;
    }>;
}

/**
 * Build JSON template containing only fields for 1Password item.
 * Metadata (title, vault, category) is passed via CLI flags.
 */
function buildFieldsTemplate(fields: Array<{ key: string; value: string }>, secret: boolean): OpFieldsTemplate {
    const fieldType = secret ? "CONCEALED" : "STRING";
    return {
        fields: fields.map(({ key, value }) => ({
            type: fieldType,
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
    secret: boolean,
): OpFieldsTemplate & { title: string; vault: { name: string }; category: string } {
    return {
        title,
        vault: { name: vault },
        category: "SECURE_NOTE",
        ...buildFieldsTemplate(fields, secret),
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
            { verbose },
        );

        // WSL → Windows op.exe always treats the spawned stdin as piped input
        // and rejects --template. Fall back to piping the full template via
        // stdin (no --template), which op.exe accepts.
        if (result.exitCode !== 0 && isTemplateStdinCollision(result.stderr)) {
            result = await execWithStdin("op", ["item", "create", "--format", "json"], {
                stdin: JSON.stringify(buildFullTemplate(title, vault, fields, secret)),
                verbose,
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
            { verbose },
        );

        // WSL → Windows op.exe always treats the spawned stdin as piped input
        // and rejects --template. Fall back to piping the full template via
        // stdin (no --template), which op.exe accepts.
        if (result.exitCode !== 0 && isTemplateStdinCollision(result.stderr)) {
            result = await execWithStdin("op", ["item", "edit", itemId, "--format", "json"], {
                stdin: JSON.stringify(buildFullTemplate(title, vault, fields, secret)),
                verbose,
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
