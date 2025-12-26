/**
 * Custom error class for env2op with error codes and suggestions
 */
export class Env2OpError extends Error {
    constructor(
        message: string,
        public code: ErrorCode,
        public suggestion?: string,
    ) {
        super(message);
        this.name = "Env2OpError";
    }
}

/**
 * Error codes for different failure scenarios
 */
export const ErrorCodes = {
    ENV_FILE_NOT_FOUND: "ENV_FILE_NOT_FOUND",
    ENV_FILE_EMPTY: "ENV_FILE_EMPTY",
    OP_CLI_NOT_INSTALLED: "OP_CLI_NOT_INSTALLED",
    OP_NOT_SIGNED_IN: "OP_NOT_SIGNED_IN",
    VAULT_NOT_FOUND: "VAULT_NOT_FOUND",
    VAULT_CREATE_FAILED: "VAULT_CREATE_FAILED",
    ITEM_EXISTS: "ITEM_EXISTS",
    ITEM_CREATE_FAILED: "ITEM_CREATE_FAILED",
    PARSE_ERROR: "PARSE_ERROR",
    TEMPLATE_NOT_FOUND: "TEMPLATE_NOT_FOUND",
    INJECT_FAILED: "INJECT_FAILED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Error factory functions for common scenarios
 */
export const errors = {
    envFileNotFound: (path: string) =>
        new Env2OpError(
            `File not found: ${path}`,
            ErrorCodes.ENV_FILE_NOT_FOUND,
            "Check that the file path is correct",
        ),

    envFileEmpty: (path: string) =>
        new Env2OpError(
            `No valid environment variables found in ${path}`,
            ErrorCodes.ENV_FILE_EMPTY,
            "Ensure the file contains KEY=value pairs",
        ),

    opCliNotInstalled: () =>
        new Env2OpError(
            "1Password CLI (op) is not installed",
            ErrorCodes.OP_CLI_NOT_INSTALLED,
            "Install it from https://1password.com/downloads/command-line/",
        ),

    opNotSignedIn: () =>
        new Env2OpError(
            "Not signed in to 1Password CLI",
            ErrorCodes.OP_NOT_SIGNED_IN,
            'Run "op signin" to authenticate',
        ),

    vaultNotFound: (vault: string) =>
        new Env2OpError(
            `Vault not found: ${vault}`,
            ErrorCodes.VAULT_NOT_FOUND,
            'Run "op vault list" to see available vaults',
        ),

    vaultCreateFailed: (message: string) =>
        new Env2OpError(`Failed to create vault: ${message}`, ErrorCodes.VAULT_CREATE_FAILED),

    itemExists: (title: string, vault: string) =>
        new Env2OpError(
            `Item "${title}" already exists in vault "${vault}"`,
            ErrorCodes.ITEM_EXISTS,
            "Use default behavior (overwrites) or choose a different item name",
        ),

    itemCreateFailed: (message: string) =>
        new Env2OpError(`Failed to create 1Password item: ${message}`, ErrorCodes.ITEM_CREATE_FAILED),

    parseError: (line: number, message: string) =>
        new Env2OpError(`Parse error at line ${line}: ${message}`, ErrorCodes.PARSE_ERROR),
};
