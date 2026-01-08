/**
 * Command error handler utility
 */

import { Env2OpError } from "./errors";
import { logger } from "./logger";

/**
 * Handle command errors consistently.
 * Logs Env2OpError with suggestions, re-throws unknown errors.
 */
export function handleCommandError(error: unknown): never {
    if (error instanceof Env2OpError) {
        logger.error(error.message);
        if (error.suggestion) {
            logger.info(`Suggestion: ${error.suggestion}`);
        }
        process.exit(1);
    }
    throw error;
}
