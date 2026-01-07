import { basename, dirname, join } from "node:path";
import * as p from "@clack/prompts";
import { parseEnvFile, validateParseResult } from "../core/env-parser";
import {
    checkOpCli,
    checkSignedIn,
    createSecureNote,
    createVault,
    editSecureNote,
    itemExists,
    vaultExists,
} from "../core/onepassword";
import { generateTemplateContent, generateUsageInstructions, writeTemplate } from "../core/template-generator";
import type { ConvertOptions, CreateItemResult } from "../core/types";
import { Env2OpError } from "../utils/errors";
import { logger } from "../utils/logger";

/**
 * Execute the convert operation
 */
export async function runConvert(options: ConvertOptions): Promise<void> {
    const { envFile, vault, itemName, output, dryRun, secret, force, verbose } = options;

    // Display intro
    const pkg = await import("../../package.json");
    logger.intro("env2op", pkg.version, dryRun);

    try {
        // Step 1: Parse .env file
        const parseResult = parseEnvFile(envFile);
        validateParseResult(parseResult, envFile);

        const { variables, lines } = parseResult;

        logger.success(`Parsed ${basename(envFile)}`);
        logger.message(`Found ${variables.length} environment variable${variables.length === 1 ? "" : "s"}`);

        // Show parse errors as warnings
        for (const error of parseResult.errors) {
            logger.warn(error);
        }

        // Step 2: Create or update 1Password Secure Note
        let itemResult: CreateItemResult | null = null;

        if (dryRun) {
            logger.warn("Would create Secure Note");
            logger.keyValue("Vault", vault);
            logger.keyValue("Title", itemName);
            logger.keyValue("Type", secret ? "password (hidden)" : "text (visible)");
            logger.keyValue("Fields", logger.formatFields(variables.map((v) => v.key)));
        } else {
            // Check 1Password CLI before attempting
            const opInstalled = await checkOpCli({ verbose });
            if (!opInstalled) {
                throw new Env2OpError(
                    "1Password CLI (op) is not installed",
                    "OP_CLI_NOT_INSTALLED",
                    "Install from https://1password.com/downloads/command-line/",
                );
            }

            const signedIn = await checkSignedIn({ verbose });
            if (!signedIn) {
                throw new Env2OpError(
                    "Not signed in to 1Password CLI",
                    "OP_NOT_SIGNED_IN",
                    'Run "op signin" to authenticate',
                );
            }

            // Check if vault exists
            const vaultFound = await vaultExists(vault, { verbose });

            if (vaultFound) {
                logger.success(`Vault "${vault}" found`);
            } else {
                if (force) {
                    // Auto-create vault
                    logger.warn(`Vault "${vault}" not found, creating...`);
                    await createVault(vault, { verbose });
                    logger.success(`Created vault "${vault}"`);
                } else {
                    // Ask for confirmation to create vault
                    const shouldCreate = await p.confirm({
                        message: `Vault "${vault}" does not exist. Create it?`,
                    });

                    if (p.isCancel(shouldCreate) || !shouldCreate) {
                        logger.cancel("Operation cancelled");
                        logger.info('Run "op vault list" to see available vaults');
                        process.exit(0);
                    }

                    const spinner = logger.spinner();
                    spinner.start(`Creating vault "${vault}"...`);
                    await createVault(vault, { verbose });
                    spinner.stop(`Created vault "${vault}"`);
                }
            }

            // Check if item already exists
            const exists = await itemExists(vault, itemName, { verbose });

            if (exists) {
                // Item exists - update it in place (preserves UUID, avoids trash)
                if (!force) {
                    const shouldOverwrite = await p.confirm({
                        message: `Item "${itemName}" already exists in vault "${vault}". Update it?`,
                    });

                    if (p.isCancel(shouldOverwrite) || !shouldOverwrite) {
                        logger.cancel("Operation cancelled");
                        process.exit(0);
                    }
                }

                // Don't use spinner in verbose mode - it interferes with command output
                const spinner = verbose ? null : logger.spinner();
                spinner?.start(`Updating "${itemName}"...`);

                try {
                    itemResult = await editSecureNote({
                        vault,
                        title: itemName,
                        fields: variables,
                        secret,
                        verbose,
                    });

                    if (spinner) {
                        spinner.stop(`Updated "${itemResult.title}" in vault "${itemResult.vault}"`);
                    } else {
                        logger.success(`Updated "${itemResult.title}" in vault "${itemResult.vault}"`);
                    }
                } catch (error) {
                    spinner?.stop("Failed to update Secure Note");
                    throw error;
                }
            } else {
                // Item doesn't exist - create new
                // Don't use spinner in verbose mode - it interferes with command output
                const spinner = verbose ? null : logger.spinner();
                spinner?.start("Creating 1Password Secure Note...");

                try {
                    itemResult = await createSecureNote({
                        vault,
                        title: itemName,
                        fields: variables,
                        secret,
                        verbose,
                    });

                    if (spinner) {
                        spinner.stop(`Created "${itemResult.title}" in vault "${itemResult.vault}"`);
                    } else {
                        logger.success(`Created "${itemResult.title}" in vault "${itemResult.vault}"`);
                    }
                } catch (error) {
                    spinner?.stop("Failed to create Secure Note");
                    throw error;
                }
            }
        }

        // Step 3: Generate template file
        const templatePath = output ?? join(dirname(envFile), `${basename(envFile)}.tpl`);
        const templateFileName = basename(templatePath);

        if (dryRun) {
            logger.warn(`Would generate template: ${templatePath}`);
        } else if (itemResult) {
            const templateContent = generateTemplateContent(
                {
                    vaultId: itemResult.vaultId,
                    itemId: itemResult.id,
                    variables,
                    lines,
                    fieldIds: itemResult.fieldIds,
                },
                templateFileName,
            );
            writeTemplate(templateContent, templatePath);
            logger.success(`Generated template: ${templatePath}`);
        }

        // Step 4: Show usage instructions
        if (dryRun) {
            logger.outro("Dry run complete. No changes made.");
        } else {
            const usage = generateUsageInstructions(templatePath);
            logger.note(usage, "Next steps");
            logger.outro("Done! Your secrets are now in 1Password");
        }
    } catch (error) {
        if (error instanceof Env2OpError) {
            logger.error(error.message);
            if (error.suggestion) {
                logger.info(`Suggestion: ${error.suggestion}`);
            }
            process.exit(1);
        }
        throw error;
    }
}
