/**
 * Confirmation prompt utilities
 */

import * as p from "@clack/prompts";
import { logger } from "./logger";

/**
 * Show a confirmation prompt and exit if cancelled or declined.
 * Returns only if user confirms.
 */
export async function confirmOrExit(message: string): Promise<void> {
    const confirmed = await p.confirm({ message });

    if (p.isCancel(confirmed) || !confirmed) {
        logger.cancel("Operation cancelled");
        process.exit(0);
    }
}
