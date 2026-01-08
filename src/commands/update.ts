/**
 * Update command handler
 * Checks for updates and installs them if available
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import { detectPackageManager } from "../lib/package-manager";
import { checkForUpdate, performUpdate, skipVersion } from "../lib/update";
import {
    askToUpdate,
    showPackageManagerInfo,
    showUpdateAvailable,
    showUpdateError,
    showUpdateSuccess,
    showUpToDate,
} from "../lib/update-prompts";

export interface UpdateOptions {
    force?: boolean; // --force: Skip confirmation
    verbose?: boolean; // --verbose: Show detailed output
    cliName?: string; // Name of the CLI for display (env2op or op2env)
}

/**
 * Run the update command
 */
export async function runUpdate(options: UpdateOptions): Promise<void> {
    const { force = false, cliName = "env2op" } = options;

    // Show intro
    p.intro(pc.bgCyan(pc.black(` ${cliName} update `)));

    // Check for updates with spinner
    const spinner = p.spinner();
    spinner.start("Checking for updates...");

    const result = await checkForUpdate(true); // Force check

    spinner.stop("Checked for updates");

    // No update available
    if (!result.updateAvailable || !result.latestVersion) {
        showUpToDate(result.currentVersion);
        return;
    }

    // Update available - show info
    showUpdateAvailable(result);

    // Detect package manager
    const pm = await detectPackageManager();
    showPackageManagerInfo(pm);

    // Ask user unless --force
    if (!force) {
        const choice = await askToUpdate(result);

        if (choice === "skip") {
            skipVersion(result.latestVersion);
            p.log.info(`Skipped version ${result.latestVersion}`);
            return;
        }

        if (choice === "later") {
            p.log.info("Update postponed");
            return;
        }
    }

    // Perform update with spinner
    const updateSpinner = p.spinner();
    updateSpinner.start(`Updating to ${result.latestVersion}...`);

    const updateResult = await performUpdate(pm);

    if (updateResult.success) {
        updateSpinner.stop("Update completed");
        showUpdateSuccess(result.latestVersion);
    } else {
        updateSpinner.stop("Update failed");
        showUpdateError(updateResult.error, pm);
        process.exit(1);
    }
}
