/**
 * env2op - Convert .env files to 1Password Secure Notes
 *
 * This module exports the core functionality for programmatic use.
 */

// Core types
export type {
	EnvVariable,
	ParseResult,
	CreateItemOptions,
	CreateItemResult,
	ConvertOptions,
	TemplateOptions,
} from "./core/types";

// Env parsing
export { parseEnvFile, validateParseResult } from "./core/env-parser";

// 1Password integration
export {
	checkOpCli,
	checkSignedIn,
	itemExists,
	deleteItem,
	createSecureNote,
	vaultExists,
	createVault,
} from "./core/onepassword";

// Template generation
export {
	generateTemplateContent,
	writeTemplate,
	generateUsageInstructions,
} from "./core/template-generator";

// Errors
export { Env2OpError, ErrorCodes, errors } from "./utils/errors";
