/**
 * Represents a single environment variable parsed from a .env file
 */
export interface EnvVariable {
    /** The variable name/key */
    key: string;
    /** The variable value */
    value: string;
    /** Optional comment from preceding line */
    comment?: string;
    /** Line number in source file */
    line: number;
}

/**
 * Represents a line in the .env file (preserves structure)
 */
export type EnvLine =
    | { type: "comment"; content: string }
    | { type: "empty" }
    | { type: "variable"; key: string; value: string };

/**
 * Result of parsing an .env file
 */
export interface ParseResult {
    /** Successfully parsed variables */
    variables: EnvVariable[];
    /** All lines preserving structure */
    lines: EnvLine[];
    /** Any parse errors encountered */
    errors: string[];
}

/**
 * How env values are stored in the 1Password item
 */
export enum SecretType {
    /** Every field is a visible text field */
    text = "text",
    /** Every field is a concealed password field */
    password = "password",
    /** Concealed or visible per field, based on the variable name */
    auto = "auto",
}

/** Human-readable description of each secret type, used in CLI output */
export const SECRET_TYPE_LABELS: Record<SecretType, string> = {
    [SecretType.text]: "text (visible)",
    [SecretType.password]: "password (hidden)",
    [SecretType.auto]: "auto detect (hidden or visible)",
};

/**
 * Parse a `--secret` option value into a SecretType.
 * Returns null for unrecognised values so callers can report the error.
 */
export function parseSecretType(value: string): SecretType | null {
    return Object.values(SecretType).includes(value as SecretType) ? (value as SecretType) : null;
}

/**
 * Options for creating a 1Password Secure Note
 */
export interface CreateItemOptions {
    /** Vault name */
    vault: string;
    /** Item title */
    title: string;
    /** Fields to store */
    fields: EnvVariable[];
    /** Store all as password type (hidden) or text (visible) or detect from environment variable name */
    secret: SecretType;
}

/**
 * Options for editing a 1Password Secure Note
 */
export interface EditItemOptions extends CreateItemOptions {
    /** Item ID for reliable lookup (more robust than using title) */
    itemId: string;
}

/**
 * Result of creating a 1Password item
 */
export interface CreateItemResult {
    /** 1Password item ID */
    id: string;
    /** Item title */
    title: string;
    /** Vault name */
    vault: string;
    /** Vault ID */
    vaultId: string;
    /** Field IDs mapped by field label */
    fieldIds: Record<string, string>;
}

/**
 * Options for the convert command (env2op)
 */
export interface ConvertOptions {
    /** Path to .env file */
    envFile: string;
    /** 1Password vault name */
    vault: string;
    /** Secure Note title */
    itemName: string;
    /** Custom output path for template file */
    output?: string;
    /** Preview mode - don't make changes */
    dryRun: boolean;
    /** Store fields as text or password type, or auto-detect from environment variable name */
    secret: SecretType;
    /** Skip confirmation prompts */
    force: boolean;
    /** Show op CLI output */
    verbose: boolean;
}

/**
 * Options for the inject command (op2env)
 */
export interface InjectOptions {
    /** Path to template file */
    templateFile: string;
    /** Custom output path for .env file */
    output?: string;
    /** Preview mode - don't make changes */
    dryRun: boolean;
    /** Skip confirmation prompts */
    force: boolean;
    /** Show op CLI output */
    verbose: boolean;
}

/**
 * Options for template generation
 */
export interface TemplateOptions {
    /** Vault ID */
    vaultId: string;
    /** Item ID in 1Password */
    itemId: string;
    /** Variables to include */
    variables: EnvVariable[];
    /** All lines preserving structure */
    lines: EnvLine[];
    /** Field IDs mapped by field label */
    fieldIds: Record<string, string>;
}
