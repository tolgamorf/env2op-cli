/**
 * env2op - Convert .env files to 1Password Secure Notes
 *
 * This module exports the core functionality for programmatic use.
 */

// Env parsing
export { parseEnvFile, validateParseResult } from "./core/env-parser";
// 1Password integration
export {
    checkOpCli,
    checkSignedIn,
    createSecureNote,
    createVault,
    editSecureNote,
    itemExists,
    vaultExists,
} from "./core/onepassword";
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
    TemplateOptions,
} from "./core/types";

// Errors
export { Env2OpError, ErrorCodes, errors } from "./utils/errors";
