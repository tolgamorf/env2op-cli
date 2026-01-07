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
 * Options for creating a 1Password Secure Note
 */
export interface CreateItemOptions {
    /** Vault name */
    vault: string;
    /** Item title */
    title: string;
    /** Fields to store */
    fields: EnvVariable[];
    /** Store as password type (hidden) instead of text (visible) */
    secret: boolean;
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
    /** Store all fields as password type */
    secret: boolean;
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
