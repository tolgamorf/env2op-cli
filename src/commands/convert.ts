import { basename, dirname, join } from "node:path";
import { setTimeout } from "node:timers/promises";
import * as p from "@clack/prompts";
import { parseEnvFile, validateParseResult } from "../core/env-parser";

const MIN_SPINNER_TIME = 500; // Minimum time to show spinner state (ms)

/**
 * Run an async operation with minimum display time for the spinner
 */
async function withMinTime<T>(promise: Promise<T>, minTime = MIN_SPINNER_TIME): Promise<T> {
    const [result] = await Promise.all([promise, setTimeout(minTime)]);
    return result;
}

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

        const varCount = variables.length;
        logger.success(`Parsed ${basename(envFile)} — found ${varCount} variable${varCount === 1 ? "" : "s"}`);

        // Show parse errors as warnings
        for (const error of parseResult.errors) {
            logger.warn(error);
        }

        // Step 2: Create or update 1Password Secure Note
        let itemResult: CreateItemResult | null = null;

        if (dryRun) {
            logger.step("Checking 1Password CLI...");
            logger.warn("Would check if 1Password CLI is installed and authenticated");

            logger.step(`Checking for vault "${vault}"...`);
            logger.warn(`Would check if vault "${vault}" exists`);

            logger.step(`Checking for item "${itemName}"...`);
            logger.warn(`Would check if item "${itemName}" exists`);

            logger.step("Pushing environment variables...");
            logger.warn("Would push to 1Password:");
            logger.keyValue("Vault", vault);
            logger.keyValue("Title", itemName);
            logger.keyValue("Type", secret ? "password (hidden)" : "text (visible)");
            logger.keyValue("Fields", logger.formatFields(variables.map((v) => v.key)));
        } else {
            // Check 1Password CLI before attempting
            const authSpinner = p.spinner();
            authSpinner.start("Checking 1Password CLI...");

            const opInstalled = await checkOpCli({ verbose });
            if (!opInstalled) {
                authSpinner.stop("1Password CLI not found");
                throw new Env2OpError(
                    "1Password CLI (op) is not installed",
                    "OP_CLI_NOT_INSTALLED",
                    "Install from https://1password.com/downloads/command-line/",
                );
            }

            const signedIn = await checkSignedIn({ verbose });
            if (!signedIn) {
                authSpinner.stop("Not signed in to 1Password");
                throw new Env2OpError(
                    "Not signed in to 1Password CLI",
                    "OP_NOT_SIGNED_IN",
                    'Run "op signin" to authenticate',
                );
            }

            authSpinner.stop("1Password CLI ready");

            // Check if vault exists
            const vaultSpinner = p.spinner();
            vaultSpinner.start(`Checking for vault "${vault}"...`);
            const vaultFound = await withMinTime(vaultExists(vault, { verbose }));

            if (vaultFound) {
                vaultSpinner.stop(`Vault "${vault}" found`);
            } else {
                if (force) {
                    // Auto-create vault
                    vaultSpinner.message(`Vault "${vault}" not found, creating...`);
                    await createVault(vault, { verbose });
                    vaultSpinner.stop(`Created vault "${vault}"`);
                } else {
                    vaultSpinner.stop(`Vault "${vault}" not found`);

                    // Ask for confirmation to create vault
                    const shouldCreate = await p.confirm({
                        message: `Vault "${vault}" does not exist. Create it?`,
                    });

                    if (p.isCancel(shouldCreate) || !shouldCreate) {
                        logger.cancel("Operation cancelled");
                        logger.info('Run "op vault list" to see available vaults');
                        process.exit(0);
                    }

                    const createSpinner = p.spinner();
                    createSpinner.start(`Creating vault "${vault}"...`);
                    await createVault(vault, { verbose });
                    createSpinner.stop(`Created vault "${vault}"`);
                }
            }

            // Check if item already exists
            const itemSpinner = p.spinner();
            itemSpinner.start(`Checking for item "${itemName}"...`);
            const exists = await withMinTime(itemExists(vault, itemName, { verbose }));

            if (exists) {
                itemSpinner.stop(`Item "${itemName}" found`);

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
            } else {
                itemSpinner.stop(`Item "${itemName}" not found`);
            }

            // Push environment variables to 1Password
            logger.step("Pushing environment variables...");

            try {
                if (exists) {
                    itemResult = await editSecureNote({
                        vault,
                        title: itemName,
                        fields: variables,
                        secret,
                        verbose,
                    });
                } else {
                    itemResult = await createSecureNote({
                        vault,
                        title: itemName,
                        fields: variables,
                        secret,
                        verbose,
                    });
                }

                logger.message("Completed");
                logger.success(
                    exists
                        ? `Updated "${itemResult.title}" in vault "${itemResult.vault}"`
                        : `Created "${itemResult.title}" in vault "${itemResult.vault}"`,
                );
            } catch (error) {
                logger.error(exists ? "Failed to update Secure Note" : "Failed to create Secure Note");
                throw error;
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
