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

interface OpItemTemplate {
    title: string;
    vault: { name: string };
    category: string;
    fields: Array<{
        type: "STRING" | "CONCEALED";
        label: string;
        value: string;
    }>;
}

/**
 * Build JSON template for 1Password item (works for both create and edit)
 */
function buildItemTemplate(
    title: string,
    vault: string,
    fields: Array<{ key: string; value: string }>,
    secret: boolean,
): OpItemTemplate {
    const fieldType = secret ? "CONCEALED" : "STRING";
    return {
        title,
        vault: { name: vault },
        category: "SECURE_NOTE",
        fields: fields.map(({ key, value }) => ({
            type: fieldType,
            label: key,
            value,
        })),
    };
}

/**
 * Create a Secure Note in 1Password with the given fields
 */
export async function createSecureNote(options: CreateItemOptions & VerboseOption): Promise<CreateItemResult> {
    const { vault, title, fields, secret, verbose } = options;

    const template = buildItemTemplate(title, vault, fields, secret);
    const json = JSON.stringify(template);

    try {
        const result = await execWithStdin("op", ["item", "create", "--format", "json"], { stdin: json, verbose });

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || "Failed to create item");
        }

        const item = JSON.parse(result.stdout) as OpItemResult;

        // Extract field IDs mapped by label
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
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw errors.itemCreateFailed(message);
    }
}

/**
 * Edit an existing Secure Note in 1Password - updates fields in place
 * This preserves the item UUID and doesn't add to trash
 * JSON piping completely replaces fields - no need for manual deletion
 */
export async function editSecureNote(options: EditItemOptions & VerboseOption): Promise<CreateItemResult> {
    const { vault, title, fields, secret, verbose, itemId } = options;

    const template = buildItemTemplate(title, vault, fields, secret);
    const json = JSON.stringify(template);

    try {
        const result = await execWithStdin("op", ["item", "edit", itemId, "--format", "json"], {
            stdin: json,
            verbose,
        });

        if (result.exitCode !== 0) {
            throw new Error(result.stderr || "Failed to edit item");
        }

        const item = JSON.parse(result.stdout) as OpItemResult;

        // Extract field IDs mapped by label
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
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw errors.itemEditFailed(message);
    }
}
