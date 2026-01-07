import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { setTimeout } from "node:timers/promises";
import * as p from "@clack/prompts";
import { stripHeaders } from "../core/env-parser";
import { checkOpCli, checkSignedIn, signIn } from "../core/onepassword";
import { generateEnvHeader } from "../core/template-generator";
import type { InjectOptions } from "../core/types";
import { Env2OpError } from "../utils/errors";
import { logger } from "../utils/logger";
import { exec } from "../utils/shell";

const MIN_SPINNER_TIME = 500;

async function withMinTime<T>(promise: Promise<T>, minTime = MIN_SPINNER_TIME): Promise<T> {
    const [result] = await Promise.all([promise, setTimeout(minTime)]);
    return result;
}

/**
 * Derive output path from template path
 * .env.tpl -> .env
 * .env.local.tpl -> .env.local
 * secrets.tpl -> secrets
 */
function deriveOutputPath(templatePath: string): string {
    if (templatePath.endsWith(".tpl")) {
        return templatePath.slice(0, -4);
    }
    return `${templatePath}.env`;
}

/**
 * Execute the inject operation (op2env)
 */
export async function runInject(options: InjectOptions): Promise<void> {
    const { templateFile, output, dryRun, force, verbose } = options;
    const outputPath = output ?? deriveOutputPath(templateFile);

    // Display intro
    const pkg = await import("../../package.json");
    logger.intro("op2env", pkg.version, dryRun);

    try {
        // Step 1: Check template file exists
        if (!existsSync(templateFile)) {
            throw new Env2OpError(
                `Template file not found: ${templateFile}`,
                "TEMPLATE_NOT_FOUND",
                "Ensure the file exists and the path is correct",
            );
        }

        logger.success(`Found template: ${basename(templateFile)}`);

        // Step 2: Check 1Password CLI
        if (!dryRun) {
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

            let signedIn = await checkSignedIn({ verbose });
            if (!signedIn) {
                authSpinner.message("Signing in to 1Password...");

                const signInSuccess = await signIn({ verbose });
                if (!signInSuccess) {
                    authSpinner.stop();
                    throw new Env2OpError(
                        "Failed to sign in to 1Password CLI",
                        "OP_SIGNIN_FAILED",
                        'Try running "op signin" manually',
                    );
                }

                // Verify sign-in was successful
                signedIn = await checkSignedIn({ verbose });
                if (!signedIn) {
                    authSpinner.stop();
                    throw new Env2OpError(
                        "Not signed in to 1Password CLI",
                        "OP_NOT_SIGNED_IN",
                        'Run "op signin" to authenticate',
                    );
                }
            }

            authSpinner.stop("1Password CLI ready");
        }

        // Step 3: Check if output file exists
        const outputExists = existsSync(outputPath);

        if (dryRun) {
            if (outputExists) {
                logger.warn(`Would overwrite: ${outputPath}`);
            } else {
                logger.warn(`Would create: ${outputPath}`);
            }
            logger.outro("Dry run complete. No changes made.");
            return;
        }

        if (outputExists && !force) {
            const shouldOverwrite = await p.confirm({
                message: `File "${outputPath}" already exists. Overwrite?`,
            });

            if (p.isCancel(shouldOverwrite) || !shouldOverwrite) {
                logger.cancel("Operation cancelled");
                process.exit(0);
            }
        }

        // Step 4: Run op inject
        // Don't use spinner in verbose mode - it interferes with command output
        const spinner = verbose ? null : logger.spinner();
        spinner?.start("Pulling secrets from 1Password...");

        try {
            const result = await withMinTime(
                exec("op", ["inject", "-i", templateFile, "-o", outputPath, "-f"], { verbose }),
            );

            if (result.exitCode !== 0) {
                throw new Error(result.stderr);
            }

            // Strip any existing headers and prepend fresh .env header
            const rawContent = readFileSync(outputPath, "utf-8");
            const envContent = stripHeaders(rawContent);
            const header = generateEnvHeader(basename(outputPath)).join("\n");
            writeFileSync(outputPath, header + envContent, "utf-8");

            // Count variables (non-empty, non-comment lines)
            const varCount = envContent
                .split("\n")
                .filter((line) => line.trim() && !line.trim().startsWith("#")).length;

            const stopMessage = `Generated ${basename(outputPath)} — ${varCount} variable${varCount === 1 ? "" : "s"}`;
            if (spinner) {
                spinner.stop(stopMessage);
            } else {
                logger.success(stopMessage);
            }
        } catch (error) {
            spinner?.stop("Failed to pull secrets");
            // Extract stderr from error
            const stderr = (error as { stderr?: string })?.stderr;
            const message = stderr || (error instanceof Error ? error.message : String(error));
            throw new Env2OpError("Failed to pull secrets from 1Password", "INJECT_FAILED", message);
        }

        logger.outro("Done! Your .env file is ready");
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
