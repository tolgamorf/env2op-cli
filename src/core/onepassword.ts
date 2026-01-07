import { errors } from "../utils/errors";
import { exec, execJson } from "../utils/shell";
import type { CreateItemOptions, CreateItemResult } from "./types";


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
    const result = await exec("op", ["account", "get", "--format", "json"], options);
    return result.exitCode === 0;
}

/**
 * Check if an item exists in a vault using item list
 */
export async function itemExists(vault: string, title: string, options: VerboseOption = {}): Promise<boolean> {
    const result = await exec("op", ["item", "list", "--vault", vault, "--format", "json"], options);
    if (result.exitCode !== 0) {
        return false;
    }
    try {
        const items = JSON.parse(result.stdout) as Array<{ title: string }>;
        return items.some((item) => item.title === title);
    } catch {
        return false;
    }
}

/**
 * Check if a vault exists
 */
export async function vaultExists(vault: string, options: VerboseOption = {}): Promise<boolean> {
    const result = await exec("op", ["vault", "get", vault, "--format", "json"], options);
    return result.exitCode === 0;
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

/**
 * Create a Secure Note in 1Password with the given fields
 */
export async function createSecureNote(options: CreateItemOptions & VerboseOption): Promise<CreateItemResult> {
    const { vault, title, fields, secret, verbose } = options;

    // Build field arguments
    const fieldType = secret ? "password" : "text";
    const fieldArgs = fields.map(({ key, value }) => `${key}[${fieldType}]=${value}`);

    try {
        // Step 1: Create the item (no --format=json, op CLI hangs with it when piped)
        const createArgs = [
            "item",
            "create",
            "--category",
            "Secure Note",
            "--vault",
            vault,
            "--title",
            title,
            ...fieldArgs,
        ];

        const createResult = await exec("op", createArgs, { verbose });
        if (createResult.exitCode !== 0) {
            throw new Error(createResult.stderr || "Failed to create item");
        }

        // Step 2: Get the created item info
        const getResult = await execJson<OpItemResult>("op", ["item", "get", title, "--vault", vault, "--format", "json"], { verbose });

        // Extract field IDs mapped by label
        const fieldIds: Record<string, string> = {};
        if (Array.isArray(getResult.fields)) {
            for (const field of getResult.fields) {
                if (field.label && field.id) {
                    fieldIds[field.label] = field.id;
                }
            }
        }

        return {
            id: getResult.id,
            title: getResult.title,
            vault: getResult.vault?.name ?? vault,
            vaultId: getResult.vault?.id ?? "",
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
 */
export async function editSecureNote(options: CreateItemOptions & VerboseOption): Promise<CreateItemResult> {
    const { vault, title, fields, secret, verbose } = options;

    // Build field arguments for edit
    const fieldType = secret ? "password" : "text";
    const fieldArgs = fields.map(({ key, value }) => `${key}[${fieldType}]=${value}`);

    try {
        // Step 1: Edit the item (no --format=json, op CLI hangs with it when piped)
        const editArgs = ["item", "edit", title, "--vault", vault, ...fieldArgs];

        const editResult = await exec("op", editArgs, { verbose });
        if (editResult.exitCode !== 0) {
            throw new Error(editResult.stderr || "Failed to edit item");
        }

        // Step 2: Get the updated item info
        const getResult = await execJson<OpItemResult>("op", ["item", "get", title, "--vault", vault, "--format", "json"], { verbose });

        // Extract field IDs mapped by label
        const fieldIds: Record<string, string> = {};
        if (Array.isArray(getResult.fields)) {
            for (const field of getResult.fields) {
                if (field.label && field.id) {
                    fieldIds[field.label] = field.id;
                }
            }
        }

        return {
            id: getResult.id,
            title: getResult.title,
            vault: getResult.vault?.name ?? vault,
            vaultId: getResult.vault?.id ?? "",
            fieldIds,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw errors.itemCreateFailed(message);
    }
}
