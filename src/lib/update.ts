/**
 * Auto-update checking and update functionality
 * Uses npm registry to check for new versions
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { exec } from "../utils/shell";
import { detectPackageManager, type PackageManagerInfo } from "./package-manager";

// Cache configuration
const CACHE_DIR = join(homedir(), ".env2op");
const CACHE_FILE = join(CACHE_DIR, "update-check.json");
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UpdateCache {
    lastCheck: number;
    latestVersion: string | null;
    skipVersion?: string;
}

export interface UpdateCheckResult {
    currentVersion: string;
    latestVersion: string | null;
    updateAvailable: boolean;
    isSkipped: boolean;
    fromCache: boolean;
}

export interface UpdateResult {
    success: boolean;
    error?: string;
}

/**
 * Get CLI version from package.json
 */
export function getCliVersion(): string {
    try {
        // Dynamic import would be cleaner but we need sync access
        // The version is embedded at build time via bunup
        const pkg = require("../../package.json");
        return pkg.version ?? "0.0.0";
    } catch {
        return "0.0.0";
    }
}

/**
 * Load update cache from disk
 */
function loadCache(): UpdateCache {
    try {
        if (existsSync(CACHE_FILE)) {
            const content = readFileSync(CACHE_FILE, "utf-8");
            return JSON.parse(content) as UpdateCache;
        }
    } catch {
        // Invalid cache, will be recreated
    }
    return { lastCheck: 0, latestVersion: null };
}

/**
 * Save update cache to disk
 */
function saveCache(cache: UpdateCache): void {
    try {
        if (!existsSync(CACHE_DIR)) {
            mkdirSync(CACHE_DIR, { recursive: true });
        }
        writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch {
        // Silently ignore cache write errors
    }
}

/**
 * Check if we should perform an update check
 */
function shouldCheckForUpdate(cache: UpdateCache): boolean {
    const now = Date.now();
    return now - cache.lastCheck > CHECK_INTERVAL_MS;
}

/**
 * Fetch latest version from npm registry
 */
async function fetchLatestVersion(): Promise<string | null> {
    try {
        const response = await fetch("https://registry.npmjs.org/@tolgamorf/env2op-cli/latest");
        if (!response.ok) return null;
        const data = (await response.json()) as { version?: string };
        return data.version ?? null;
    } catch {
        return null;
    }
}

/**
 * Compare two semver versions
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);

    for (let i = 0; i < 3; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 < p2) return -1;
        if (p1 > p2) return 1;
    }
    return 0;
}

/**
 * Check for available updates
 * @param forceCheck - If true, skip cache and always check
 */
export async function checkForUpdate(forceCheck = false): Promise<UpdateCheckResult> {
    const currentVersion = getCliVersion();
    const cache = loadCache();

    // Use cached result if still fresh
    if (!forceCheck && !shouldCheckForUpdate(cache) && cache.latestVersion) {
        const updateAvailable = compareVersions(currentVersion, cache.latestVersion) < 0;
        const isSkipped = cache.skipVersion === cache.latestVersion;
        return {
            currentVersion,
            latestVersion: cache.latestVersion,
            updateAvailable,
            isSkipped,
            fromCache: true,
        };
    }

    // Fetch latest version
    const latestVersion = await fetchLatestVersion();

    // Update cache
    saveCache({
        ...cache,
        lastCheck: Date.now(),
        latestVersion,
    });

    if (!latestVersion) {
        return {
            currentVersion,
            latestVersion: null,
            updateAvailable: false,
            isSkipped: false,
            fromCache: false,
        };
    }

    const updateAvailable = compareVersions(currentVersion, latestVersion) < 0;
    const isSkipped = cache.skipVersion === latestVersion;

    return {
        currentVersion,
        latestVersion,
        updateAvailable,
        isSkipped,
        fromCache: false,
    };
}

/**
 * Perform the update using the detected package manager
 */
export async function performUpdate(pm?: PackageManagerInfo): Promise<UpdateResult> {
    const packageManager = pm ?? (await detectPackageManager());

    try {
        const [command, ...args] = packageManager.updateCommand.split(" ") as [string, ...string[]];
        const result = await exec(command, args, { verbose: false });

        if (result.exitCode !== 0) {
            return {
                success: false,
                error: result.stderr || `Command exited with code ${result.exitCode}`,
            };
        }

        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
    }
}

/**
 * Mark a version to be skipped (user doesn't want to be prompted again)
 */
export function skipVersion(version: string): void {
    const cache = loadCache();
    cache.skipVersion = version;
    saveCache(cache);
}

/**
 * Clear the update cache (for testing/debugging)
 */
export function clearUpdateCache(): void {
    try {
        if (existsSync(CACHE_FILE)) {
            unlinkSync(CACHE_FILE);
        }
    } catch {
        // Ignore errors
    }
}
