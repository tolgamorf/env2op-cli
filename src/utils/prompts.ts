/**
 * Confirmation prompt utilities
 */

import * as p from "@clack/prompts";
import { logger } from "./logger";

/**
 * Exit code when the user declines or cancels a confirmation prompt. Distinct from
 * 0 (the push or pull completed) and 1 (it failed), so a calling script can tell
 * "nothing was written" apart from success.
 */
export const EXIT_DECLINED = 2;

/**
 * Report that the user declined and exit with EXIT_DECLINED. Nothing has been
 * written at any of the prompts that lead here.
 */
export function exitDeclined(hint?: string): never {
    logger.cancel("Cancelled: nothing written");
    if (hint) {
        logger.info(hint);
    }
    process.exit(EXIT_DECLINED);
}

/**
 * Ask a yes/no question. Returns true only for an explicit Yes: No, Escape and Ctrl-C
 * at the prompt all return false.
 *
 * Without a terminal there is no one to answer, so it returns false at once. Prompting
 * anyway would hang on a stdin that stays open, and on one that closes the process would
 * exit 0 with the question unanswered, which a caller would read as success.
 */
export async function confirm(message: string): Promise<boolean> {
    if (!process.stdin.isTTY) {
        logger.warn(`${message} (no terminal to answer; pass -f/--force to skip this prompt)`);
        return false;
    }
    const confirmed = await p.confirm({ message });
    return !p.isCancel(confirmed) && confirmed;
}

/**
 * Ask for confirmation and exit with EXIT_DECLINED unless the user says Yes.
 * Returns only if the user confirms.
 */
export async function confirmOrExit(message: string): Promise<void> {
    if (!(await confirm(message))) {
        exitDeclined();
    }
}
