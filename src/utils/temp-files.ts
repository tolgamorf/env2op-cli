/**
 * Temporary files that must not outlive the process
 */

import { unlinkSync } from "node:fs";

const pending = new Set<string>();
let hooked = false;

function removeQuietly(path: string): void {
    try {
        unlinkSync(path);
    } catch {
        // already gone
    }
}

/**
 * Remember a temp file so it is deleted even if the process exits before its own cleanup
 * runs, as on Ctrl-C: process.exit skips `finally` blocks, but not "exit" listeners. The
 * listener is added on first use, so importing this module has no side effect.
 */
export function trackTempFile(path: string): void {
    if (!hooked) {
        hooked = true;
        process.on("exit", () => {
            for (const file of pending) {
                removeQuietly(file);
            }
        });
    }
    pending.add(path);
}

/** Delete a tracked temp file now. */
export function removeTempFile(path: string): void {
    pending.delete(path);
    removeQuietly(path);
}
