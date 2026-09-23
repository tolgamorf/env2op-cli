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
    | {
          type: "variable";
          key: string;
          value: string;
          quote?: Quote;
          /** Comment after the value, as written, including the whitespace before its `#` */
          inlineComment?: string;
      };

/** Quote character a value was wrapped in, kept so the template can quote its reference the same way */
export type Quote = '"' | "'";

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
 * How env values are stored in the 1Password item:
 * - `text`: every field is a visible text field
 * - `password`: every field is a concealed password field
 * - `auto`: concealed or visible per field, from its name and value (see determineFieldType)
 */
export type SecretType = "text" | "password" | "auto";

/** Every SecretType, in the order the CLI lists them */
export const SECRET_TYPES: readonly SecretType[] = ["text", "password", "auto"];

/** Human-readable description of each secret type, used in CLI output */
export const SECRET_TYPE_LABELS: Record<SecretType, string> = {
    text: "text (visible)",
    password: "password (hidden)",
    auto: "auto (hidden when the name or value looks secret)",
};

/**
 * Parse a `--secret` option value into a SecretType.
 * Returns null for unrecognised values so callers can report the error.
 */
export function parseSecretType(value: string): SecretType | null {
    return (SECRET_TYPES as readonly string[]).includes(value) ? (value as SecretType) : null;
}

/**
 * Normalise a `secret` option. A boolean is the form it took before SecretType existed
 * (true: password, false: text) and is still accepted from library callers.
 */
export function toSecretType(secret: boolean | SecretType): SecretType {
    if (typeof secret === "boolean") {
        return secret ? "password" : "text";
    }
    return secret;
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
    /** Field type; `true`/`false` are the older spelling of `"password"`/`"text"` */
    secret: boolean | SecretType;
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
    /** Field type; `true`/`false` are the older spelling of `"password"`/`"text"` */
    secret: boolean | SecretType;
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
    /** All lines preserving structure */
    lines: EnvLine[];
    /** Field IDs mapped by field label */
    fieldIds: Record<string, string>;
}
