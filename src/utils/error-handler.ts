/**
 * Command error handler utility
 */

import { Env2OpError } from "./errors";
import { isInterrupted } from "./interrupt";
import { logger } from "./logger";
import { exitCancelled } from "./prompts";

/**
 * Handle command errors consistently.
 * Logs Env2OpError with suggestions, re-throws unknown errors.
 */
export function handleCommandError(error: unknown): never {
    // An `op` call that failed because the same Ctrl-C reached it is a cancel, not a failure
    if (isInterrupted()) {
        exitCancelled("Interrupted");
    }
    if (error instanceof Env2OpError) {
        logger.error(error.message);
        if (error.suggestion) {
            logger.info(`Suggestion: ${error.suggestion}`);
        }
        process.exit(1);
    }
    throw error;
}
