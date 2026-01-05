import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import * as p from "@clack/prompts";
import { stripHeaders } from "../core/env-parser";
import { checkOpCli, checkSignedIn } from "../core/onepassword";
import { generateEnvHeader } from "../core/template-generator";
import type { InjectOptions } from "../core/types";
import { Env2OpError } from "../utils/errors";
import { logger } from "../utils/logger";
import { exec } from "../utils/shell";

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
    const { templateFile, output, dryRun, force } = options;
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
        const spinner = logger.spinner();
        spinner.start("Injecting secrets from 1Password...");

        try {
            const result = await exec("op", ["inject", "-i", templateFile, "-o", outputPath, "-f"]);

            if (result.exitCode !== 0) {
                throw new Error(result.stderr);
            }

            // Strip any existing headers and prepend fresh .env header
            const rawContent = readFileSync(outputPath, "utf-8");
            const envContent = stripHeaders(rawContent);
            const header = generateEnvHeader(basename(outputPath)).join("\n");
            writeFileSync(outputPath, header + envContent, "utf-8");

            spinner.stop(`Generated: ${outputPath}`);
        } catch (error) {
            spinner.stop("Failed to inject secrets");
            // Extract stderr from error
            const stderr = (error as { stderr?: string })?.stderr;
            const message = stderr || (error instanceof Error ? error.message : String(error));
            throw new Env2OpError("Failed to inject secrets from 1Password", "INJECT_FAILED", message);
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
