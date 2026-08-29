import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { ensureOpAuthenticated } from "../core/auth";
import { stripHeaders } from "../core/env-parser";
import { maskSecretRefsInComments, unmaskSecretRefs } from "../core/secret-refs";
import { refreshEnvHeader } from "../core/template-generator";
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
 * Write a masked template beside the original for op to read.
 *
 * It goes in the template's own directory, in the same path style op is already
 * handed today, rather than the system temp dir: under WSL, op is a shim onto
 * Windows op.exe, and a path it already resolves is the one to reuse.
 */
function writeMaskedTemplate(templateFile: string, contents: string): string {
    const maskedPath = `${templateFile}.env2op-${process.pid}.tmp`;
    writeFileSync(maskedPath, contents, "utf-8");
    return maskedPath;
}

function cleanupMaskedTemplate(maskedPath: string): void {
    try {
        unlinkSync(maskedPath);
    } catch {
        // ignore cleanup errors
    }
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

        // Comments that merely mention `op://` have to be masked before op sees
        // them (see core/secret-refs.ts). op always reads a file and never stdin:
        // op's macOS build does not see data on a stdin pipe opened by spawn,
        // and op.exe under WSL misreads a spawned stdin as piped input. When
        // there is nothing to mask, the original template is passed untouched.
        const template = maskSecretRefsInComments(readFileSync(templateFile, "utf-8"));
        const injectInput = template.changed ? writeMaskedTemplate(templateFile, template.text) : templateFile;

        try {
            const result = await withMinTime(
                exec("op", ["inject", "-i", injectInput, "-o", outputPath, "-f"], { verbose }),
            );

            if (result.exitCode !== 0) {
                throw new Error(result.stderr);
            }

            // Strip any existing headers and prepend fresh .env header
            const rawContent = unmaskSecretRefs(readFileSync(outputPath, "utf-8"), template.mask);
            const envContent = stripHeaders(rawContent);
            writeFileSync(outputPath, refreshEnvHeader(rawContent, basename(outputPath)), "utf-8");

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
        } finally {
            if (injectInput !== templateFile) {
                cleanupMaskedTemplate(injectInput);
            }
        }

        logger.outro("Done! Your .env file is ready");
    } catch (error) {
        handleCommandError(error);
    }
}
