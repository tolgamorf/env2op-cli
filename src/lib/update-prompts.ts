/**
 * Update notification and prompt UI components
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import type { PackageManagerInfo } from "./package-manager";
import type { UpdateCheckResult } from "./update";

export type UpdateChoice = "update" | "skip" | "later";

// Unicode box drawing characters
const S_BAR = "\u2502";
const S_BAR_START = "\u250C";
const S_BAR_END = "\u2514";

/**
 * Show update notification (non-blocking, for command mode)
 * Displayed after command completes
 */
export function showUpdateNotification(result: UpdateCheckResult, cliName = "env2op"): void {
    console.log();
    console.log(
        `${pc.gray(S_BAR_START)}${pc.gray("\u2500")} ${pc.yellow("Update available:")} ${pc.dim(result.currentVersion)} ${pc.dim("\u2192")} ${pc.green(result.latestVersion)}`,
    );
    console.log(`${pc.gray(S_BAR_END)}${pc.gray("\u2500")} Run ${pc.cyan(`'${cliName} --update'`)} to update`);
}

/**
 * Show interactive update prompt (for update command)
 */
export async function askToUpdate(result: UpdateCheckResult): Promise<UpdateChoice> {
    const response = await p.select({
        message: "Would you like to update?",
        options: [
            { value: "update", label: "Update now", hint: "Download and install the latest version" },
            { value: "later", label: "Remind me later", hint: "Ask again next time" },
            { value: "skip", label: "Skip this version", hint: `Don't ask about ${result.latestVersion} again` },
        ],
    });

    if (p.isCancel(response)) {
        return "later";
    }

    return response as UpdateChoice;
}

/**
 * Show update available message (for update command)
 */
export function showUpdateAvailable(result: UpdateCheckResult): void {
    p.log.success(
        `Update available: ${pc.dim(result.currentVersion)} ${pc.dim("\u2192")} ${pc.green(result.latestVersion)}`,
    );
}

/**
 * Show already up to date message
 */
export function showUpToDate(currentVersion: string): void {
    p.log.success(`You're on the latest version ${pc.green(`(${currentVersion})`)}`);
}

/**
 * Show package manager detection info
 */
export function showPackageManagerInfo(pm: PackageManagerInfo): void {
    console.log(pc.gray(S_BAR));
    console.log(`${pc.gray(S_BAR)}  ${pc.dim("Detected:")} ${pm.displayName} installation`);
    console.log(`${pc.gray(S_BAR)}  ${pc.dim("Command:")}  ${pc.cyan(pm.updateCommand)}`);
}

/**
 * Show update success message
 */
export function showUpdateSuccess(newVersion: string): void {
    p.log.success(`Updated to version ${pc.green(newVersion)}`);
    p.log.info("Please restart to use the new version.");
}

/**
 * Show update error and suggest manual command
 */
export function showUpdateError(error: string | undefined, pm: PackageManagerInfo): void {
    if (error) {
        p.log.error(pc.dim(error));
    }
    p.log.info(`Try running manually: ${pc.cyan(pm.updateCommand)}`);
}
