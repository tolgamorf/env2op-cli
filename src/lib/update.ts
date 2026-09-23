/**
 * Auto-update checking and update functionality
 * Uses npm registry to check for new versions
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import pkg from "../../package.json";
import { exec } from "../utils/shell";
import { detectPackageManager, type PackageManagerInfo } from "./package-manager";

// Cache configuration
let cacheDirOverride: string | undefined;
const cacheDir = () => cacheDirOverride ?? join(homedir(), ".env2op");
const cacheFile = () => join(cacheDir(), "update-check.json");

/**
 * Point the update cache at another directory, or back at ~/.env2op with undefined.
 * For tests, so they never read or write the real cache.
 */
export function setUpdateCacheDirForTesting(dir: string | undefined): void {
    cacheDirOverride = dir;
}
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
// The check runs after every command, so a slow or dead network must not hold the CLI open
const FETCH_TIMEOUT_MS = 1500;

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
    // The version is embedded at build time via bunup (static JSON import)
    return pkg.version ?? "0.0.0";
}

/**
 * Load update cache from disk
 */
function loadCache(): UpdateCache {
    try {
        if (existsSync(cacheFile())) {
            const content = readFileSync(cacheFile(), "utf-8");
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
        if (!existsSync(cacheDir())) {
            mkdirSync(cacheDir(), { recursive: true });
        }
        writeFileSync(cacheFile(), JSON.stringify(cache, null, 2));
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
        const response = await fetch("https://registry.npmjs.org/@tolgamorf/env2op-cli/latest", {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
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

/** Environment variable that turns off the automatic update check and its notice */
export const NO_UPDATE_CHECK_ENV = "ENV2OP_NO_UPDATE_CHECK";

/**
 * Whether the automatic update check is turned off: ENV2OP_NO_UPDATE_CHECK set to any
 * non-empty value other than "0" or "false". Useful where env2op is bundled at a pinned
 * version, since upgrading the global install would not change the copy being run.
 */
export function isUpdateCheckDisabled(env: Record<string, string | undefined> = process.env): boolean {
    const value = env[NO_UPDATE_CHECK_ENV]?.trim().toLowerCase();
    return !!value && value !== "0" && value !== "false";
}

/**
 * Check for updates and show notification if available (non-blocking)
 * Silently ignores any errors. Does nothing, not even a network request or a cache
 * write, when the check is turned off (see isUpdateCheckDisabled); an explicit
 * `--update` does not go through here and still works.
 */
export async function maybeShowUpdateNotification(
    cliName: string,
    showNotification: (result: UpdateCheckResult, cliName: string) => void,
): Promise<void> {
    if (isUpdateCheckDisabled()) {
        return;
    }
    try {
        const result = await checkForUpdate();
        if (result.updateAvailable && !result.isSkipped) {
            showNotification(result, cliName);
        }
    } catch {
        // Silently ignore update check errors
    }
}
