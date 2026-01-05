import { errors } from "../utils/errors";
import { exec, execJson, execQuiet } from "../utils/shell";
import type { CreateItemOptions, CreateItemResult } from "./types";

/**
 * Check if the 1Password CLI is installed
 */
export async function checkOpCli(): Promise<boolean> {
    return execQuiet("op", ["--version"]);
}

/**
 * Check if user is signed in to 1Password CLI
 */
export async function checkSignedIn(): Promise<boolean> {
    return execQuiet("op", ["account", "get"]);
}

/**
 * Check if an item exists in a vault
 */
export async function itemExists(vault: string, title: string): Promise<boolean> {
    return execQuiet("op", ["item", "get", title, "--vault", vault]);
}

/**
 * Delete an item from a vault
 */
export async function deleteItem(vault: string, title: string): Promise<void> {
    try {
        await exec("op", ["item", "delete", title, "--vault", vault]);
    } catch (_error) {
        // Item might not exist, that's fine
    }
}

interface OpCreateResult {
    id: string;
    title: string;
    vault?: { name: string; id: string };
    fields?: Array<{ label: string; id: string }>;
}

/**
 * Create a Secure Note in 1Password with the given fields
 * Note: Caller should check for existing items and handle confirmation before calling this
 */
export async function createSecureNote(options: CreateItemOptions): Promise<CreateItemResult> {
    const { vault, title, fields, secret } = options;

    // Build field arguments
    // Format: key[type]=value
    const fieldType = secret ? "password" : "text";
    const fieldArgs = fields.map(({ key, value }) => `${key}[${fieldType}]=${value}`);

    try {
        // Build the command arguments array
        const args = [
            "item",
            "create",
            "--category=Secure Note",
            `--vault=${vault}`,
            `--title=${title}`,
            "--format=json",
            ...fieldArgs,
        ];

        // Execute op command
        const result = await execJson<OpCreateResult>("op", args);

        // Extract field IDs mapped by label
        const fieldIds: Record<string, string> = {};
        if (Array.isArray(result.fields)) {
            for (const field of result.fields) {
                if (field.label && field.id) {
                    fieldIds[field.label] = field.id;
                }
            }
        }

        return {
            id: result.id,
            title: result.title,
            vault: result.vault?.name ?? vault,
            vaultId: result.vault?.id ?? "",
            fieldIds,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw errors.itemCreateFailed(message);
    }
}

/**
 * Check if a vault exists
 */
export async function vaultExists(vault: string): Promise<boolean> {
    return execQuiet("op", ["vault", "get", vault]);
}

/**
 * Create a new vault
 */
export async function createVault(name: string): Promise<void> {
    try {
        await exec("op", ["vault", "create", name]);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw errors.vaultCreateFailed(message);
    }
}
