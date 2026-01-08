/**
 * Package manager detection for auto-update functionality
 * Detects how env2op-cli was installed to provide appropriate update commands
 */

import { exec } from "../utils/shell";

export type PackageManager = "homebrew" | "npm" | "bun" | "pnpm" | "unknown";

export interface PackageManagerInfo {
    type: PackageManager;
    updateCommand: string;
    displayName: string;
}

const UPDATE_COMMANDS: Record<PackageManager, string> = {
    homebrew: "brew upgrade tolgamorf/tap/env2op-cli",
    npm: "npm update -g @tolgamorf/env2op-cli",
    bun: "bun update -g @tolgamorf/env2op-cli",
    pnpm: "pnpm update -g @tolgamorf/env2op-cli",
    unknown: "npm update -g @tolgamorf/env2op-cli",
};

const DISPLAY_NAMES: Record<PackageManager, string> = {
    homebrew: "Homebrew",
    npm: "npm",
    bun: "Bun",
    pnpm: "pnpm",
    unknown: "npm (default)",
};

/**
 * Detect package manager from binary path
 */
function detectFromPath(): PackageManager | null {
    const binPath = process.argv[1] ?? "";

    // Homebrew indicators (macOS Intel, Apple Silicon, Linux)
    if (
        binPath.includes("/Cellar/") ||
        binPath.includes("/homebrew/") ||
        binPath.includes("/opt/homebrew/") ||
        binPath.includes("/home/linuxbrew/")
    ) {
        return "homebrew";
    }

    // Bun global installation
    if (binPath.includes("/.bun/")) {
        return "bun";
    }

    // PNPM global installation
    if (binPath.includes("/pnpm/") || binPath.includes("/.pnpm/")) {
        return "pnpm";
    }

    // NPM global (node_modules paths)
    if (binPath.includes("/node_modules/")) {
        return "npm";
    }

    return null;
}

/**
 * Fallback detection using package manager commands
 * Checks which package manager has env2op-cli installed globally
 */
async function detectFromCommands(): Promise<PackageManager> {
    // Check Homebrew first (most specific)
    const brewResult = await exec("brew", ["list", "env2op-cli"], { verbose: false });
    if (brewResult.exitCode === 0) {
        return "homebrew";
    }

    // Note: bun/pnpm detection via commands is less reliable
    // as they may not have a simple "is this package installed" check
    // Fall back to npm as the most common case
    return "npm";
}

/**
 * Detect which package manager installed env2op-cli
 *
 * Detection strategy:
 * 1. Check if binary path contains package manager indicators
 * 2. Fall back to command-based detection
 * 3. Default to npm if all else fails
 */
export async function detectPackageManager(): Promise<PackageManagerInfo> {
    // Try path-based detection first (fast, no subprocess)
    const fromPath = detectFromPath();
    if (fromPath) {
        return {
            type: fromPath,
            updateCommand: UPDATE_COMMANDS[fromPath],
            displayName: DISPLAY_NAMES[fromPath],
        };
    }

    // Fall back to command-based detection
    const fromCommands = await detectFromCommands();
    return {
        type: fromCommands,
        updateCommand: UPDATE_COMMANDS[fromCommands],
        displayName: DISPLAY_NAMES[fromCommands],
    };
}

/**
 * Get package manager info without async detection
 * Uses only path-based detection, falls back to npm
 */
export function detectPackageManagerSync(): PackageManagerInfo {
    const fromPath = detectFromPath() ?? "npm";
    return {
        type: fromPath,
        updateCommand: UPDATE_COMMANDS[fromPath],
        displayName: DISPLAY_NAMES[fromPath],
    };
}

/**
 * Get the update command for a specific package manager
 */
export function getUpdateCommand(pm: PackageManager): string {
    return UPDATE_COMMANDS[pm];
}
