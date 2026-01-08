import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { ensureOpAuthenticated } from "../core/auth";
import { stripHeaders } from "../core/env-parser";
import { generateEnvHeader } from "../core/template-generator";
import type { InjectOptions } from "../core/types";
import { getCliVersion } from "../lib/update";
import { handleCommandError } from "../utils/error-handler";
import { errors } from "../utils/errors";
import { logger } from "../utils/logger";
import { confirmOrExit } from "../utils/prompts";
import { exec } from "../utils/shell";
import { withMinTime } from "../utils/timing";

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
    logger.intro("op2env", getCliVersion(), dryRun);

    try {
        // Step 1: Check template file exists
        if (!existsSync(templateFile)) {
            throw errors.templateNotFound(templateFile);
        }

        logger.success(`Found template: ${basename(templateFile)}`);

        // Step 2: Check 1Password CLI
        if (!dryRun) {
            await ensureOpAuthenticated({ verbose });
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
            await confirmOrExit(`File "${outputPath}" already exists. Overwrite?`);
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
            throw errors.injectFailed(message);
        }

        logger.outro("Done! Your .env file is ready");
    } catch (error) {
        handleCommandError(error);
    }
}
