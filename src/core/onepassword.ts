import { $ } from "bun";
import { errors } from "../utils/errors";
import type { CreateItemOptions, CreateItemResult } from "./types";

/**
 * Check if the 1Password CLI is installed
 */
export async function checkOpCli(): Promise<boolean> {
    try {
        await $`op --version`.quiet();
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if user is signed in to 1Password CLI
 */
export async function checkSignedIn(): Promise<boolean> {
    try {
        await $`op account get`.quiet();
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if an item exists in a vault
 */
export async function itemExists(vault: string, title: string): Promise<boolean> {
    try {
        await $`op item get ${title} --vault ${vault}`.quiet();
        return true;
    } catch {
        return false;
    }
}

/**
 * Delete an item from a vault
 */
export async function deleteItem(vault: string, title: string): Promise<void> {
    try {
        await $`op item delete ${title} --vault ${vault}`.quiet();
    } catch (_error) {
        // Item might not exist, that's fine
    }
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
        const result = await $`op ${args}`.json();

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
    try {
        await $`op vault get ${vault}`.quiet();
        return true;
    } catch {
        return false;
    }
}

/**
 * Create a new vault
 */
export async function createVault(name: string): Promise<void> {
    try {
        await $`op vault create ${name}`.quiet();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw errors.vaultCreateFailed(message);
    }
}
