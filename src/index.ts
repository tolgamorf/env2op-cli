/**
 * env2op - Convert .env files to 1Password Secure Notes
 *
 * This module exports the core functionality for programmatic use.
 */

// Env parsing (quoted values follow dotenv's rules)
export { type ParsedValue, parseEnvFile, parseEnvText, parseValue, validateParseResult } from "./core/env-parser";
// 1Password integration
export {
    checkOpCli,
    checkSignedIn,
    createSecureNote,
    createVault,
    determineFieldType,
    editSecureNote,
    itemExists,
    signIn,
    vaultExists,
} from "./core/onepassword";
// `op://` masking in comments, for handing a template to `op inject`
export { type MaskedTemplate, maskSecretRefsInComments, unmaskSecretRefs } from "./core/secret-refs";
// Template generation
export {
    generateTemplateContent,
    generateUsageInstructions,
    writeTemplate,
} from "./core/template-generator";
// Core types
export type {
    ConvertOptions,
    CreateItemOptions,
    CreateItemResult,
    EnvLine,
    EnvVariable,
    ParseResult,
    Quote,
    SecretType,
    TemplateOptions,
} from "./core/types";

// Errors
export { Env2OpError, ErrorCodes, errors } from "./utils/errors";
