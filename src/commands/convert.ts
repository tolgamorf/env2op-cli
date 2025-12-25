import { basename, dirname, join } from "node:path";
import * as p from "@clack/prompts";
import { parseEnvFile, validateParseResult } from "../core/env-parser";
import {
    checkOpCli,
    checkSignedIn,
    createSecureNote,
    createVault,
    deleteItem,
    itemExists,
    vaultExists,
} from "../core/onepassword";
import { generateTemplateContent, generateUsageInstructions, writeTemplate } from "../core/template-generator";
import type { ConvertOptions } from "../core/types";
import { Env2OpError } from "../utils/errors";
import { logger } from "../utils/logger";

/**
 * Execute the convert operation
 */
export async function runConvert(options: ConvertOptions): Promise<void> {
    const { envFile, vault, itemName, dryRun, secret, yes } = options;

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

        // Step 2: Create 1Password Secure Note
        if (dryRun) {
            logger.warn("Would create Secure Note");
            logger.keyValue("Vault", vault);
            logger.keyValue("Title", itemName);
            logger.keyValue("Type", secret ? "password (hidden)" : "text (visible)");
            logger.keyValue("Fields", logger.formatFields(variables.map((v) => v.key)));
        } else {
            // Check 1Password CLI before attempting
            const opInstalled = await checkOpCli();
            if (!opInstalled) {
                throw new Env2OpError(
                    "1Password CLI (op) is not installed",
                    "OP_CLI_NOT_INSTALLED",
                    "Install from https://1password.com/downloads/command-line/",
                );
            }

            const signedIn = await checkSignedIn();
            if (!signedIn) {
                throw new Env2OpError(
                    "Not signed in to 1Password CLI",
                    "OP_NOT_SIGNED_IN",
                    'Run "op signin" to authenticate',
                );
            }

            // Check if vault exists
            const vaultFound = await vaultExists(vault);

            if (!vaultFound) {
                if (yes) {
                    // Auto-create vault
                    logger.warn(`Vault "${vault}" not found, creating...`);
                    await createVault(vault);
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
                    await createVault(vault);
                    spinner.stop(`Created vault "${vault}"`);
                }
            }

            // Check if item already exists
            const exists = await itemExists(vault, itemName);

            if (exists) {
                if (yes) {
                    // Auto-accept: delete and recreate
                    logger.warn(`Item "${itemName}" already exists, overwriting...`);
                    await deleteItem(vault, itemName);
                } else {
                    // Ask for confirmation
                    const shouldOverwrite = await p.confirm({
                        message: `Item "${itemName}" already exists in vault "${vault}". Overwrite?`,
                    });

                    if (p.isCancel(shouldOverwrite) || !shouldOverwrite) {
                        logger.cancel("Operation cancelled");
                        process.exit(0);
                    }

                    await deleteItem(vault, itemName);
                }
            }

            const spinner = logger.spinner();
            spinner.start("Creating 1Password Secure Note...");

            try {
                const result = await createSecureNote({
                    vault,
                    title: itemName,
                    fields: variables,
                    secret,
                });

                spinner.stop(`Created "${result.title}" in vault "${result.vault}"`);
            } catch (error) {
                spinner.stop("Failed to create Secure Note");
                throw error;
            }
        }

        // Step 3: Generate template file
        const templateFileName = `${basename(envFile)}.tpl`;
        const templatePath = join(dirname(envFile), templateFileName);
        const templateContent = generateTemplateContent(
            {
                vault,
                itemTitle: itemName,
                variables,
                lines,
            },
            templateFileName,
        );

        if (dryRun) {
            logger.warn(`Would generate template: ${templatePath}`);
        } else {
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
