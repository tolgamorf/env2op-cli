/**
 * Ctrl-C and SIGTERM handling for the CLI entry points
 */

import { logger } from "./logger";
import { EXIT_CANCELLED } from "./prompts";

let interrupted = false;

/** Whether the process has received SIGINT or SIGTERM; no new `op` call starts after that. */
export function isInterrupted(): boolean {
    return interrupted;
}

interface Key {
    name?: string;
    ctrl?: boolean;
    sequence?: string;
}

/** The keys clack treats as cancel: Escape and Ctrl-C */
function isCancelKey(key: Key | undefined): boolean {
    return key?.name === "escape" || key?.sequence === "\x03" || (key?.ctrl === true && key.name === "c");
}

/**
 * Make Ctrl-C exit with EXIT_CANCELLED (and SIGTERM with 143) wherever the command is.
 * Before, a cancelled run could go on to push, or exit 0 as if it had succeeded:
 *
 * - On a terminal, a running clack spinner puts stdin in raw mode, so Ctrl-C (or Escape)
 *   arrives as a key, and clack answers it with process.exit(0). The keypress listener,
 *   added before any spinner's, notes the cancel key, and the exit listener turns that
 *   exit 0 into EXIT_CANCELLED.
 * - Otherwise Ctrl-C is a SIGINT (as is a signal sent by another process). A spinner's own
 *   SIGINT handler only stops the spinner, and any handler at all turns off the runtime's
 *   default exit, so the command carried on to its next step. The signal handler exits
 *   instead, one turn later so an active spinner can stop itself first; meanwhile
 *   isInterrupted() keeps new `op` calls from starting.
 *
 * At a prompt, Ctrl-C is a key as well, and confirm() handles it.
 */
export function exitOnInterrupt(): void {
    const signals = [
        ["SIGINT", EXIT_CANCELLED],
        ["SIGTERM", 143],
    ] as const;
    for (const [signal, code] of signals) {
        process.on(signal, () => {
            interrupted = true;
            setImmediate(() => {
                logger.cancel("Interrupted");
                process.exit(code);
            });
        });
    }

    // Only emitted once something (clack) enables keypress events; listening does not read stdin
    process.stdin.on("keypress", (_text: string, key: Key | undefined) => {
        if (isCancelKey(key)) {
            interrupted = true;
        }
    });
    process.on("exit", (code) => {
        if (interrupted && code === 0) {
            process.exitCode = EXIT_CANCELLED;
        }
    });
}
