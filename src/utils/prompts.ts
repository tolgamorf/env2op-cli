/**
 * Confirmation prompt utilities
 */

import * as p from "@clack/prompts";
import { logger } from "./logger";

/**
 * Exit code when the user answers No to a confirmation prompt, or there is no terminal to
 * answer it. Distinct from 0 (the push or pull completed) and 1 (it failed), so a calling
 * script can tell "nothing was written" apart from success.
 */
export const EXIT_DECLINED = 2;

/**
 * Exit code when the user cancels: Escape or Ctrl-C at a prompt, or Ctrl-C while the command
 * runs (see exitOnInterrupt). 130 is the conventional 128 + SIGINT. Kept apart from
 * EXIT_DECLINED so a script running env2op over several files can skip one on a No but stop
 * the whole run on a cancel.
 */
export const EXIT_CANCELLED = 130;

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
 * Report that the user cancelled and exit with EXIT_CANCELLED.
 */
export function exitCancelled(message = "Cancelled: nothing written"): never {
    logger.cancel(message);
    process.exit(EXIT_CANCELLED);
}

/** How a confirmation prompt was answered */
export type ConfirmAnswer = "yes" | "no" | "cancel";

/**
 * Ask a yes/no question: "yes" or "no" as answered, "cancel" for Escape or Ctrl-C at the
 * prompt (clack reads Ctrl-C there as a key, so no SIGINT is raised).
 *
 * Without a terminal there is no one to answer, so it returns "no" at once. Prompting
 * anyway would hang on a stdin that stays open, and on one that closes the process would
 * exit 0 with the question unanswered, which a caller would read as success.
 */
export async function confirm(message: string): Promise<ConfirmAnswer> {
    if (!process.stdin.isTTY) {
        logger.warn(`${message} (no terminal to answer; pass -f/--force to skip this prompt)`);
        return "no";
    }
    const answer = await p.confirm({ message });
    if (p.isCancel(answer)) {
        return "cancel";
    }
    return answer ? "yes" : "no";
}

/**
 * Ask for confirmation and return only on Yes: exit with EXIT_DECLINED on No (showing
 * `declineHint`, if given) and with EXIT_CANCELLED on Escape or Ctrl-C.
 */
export async function confirmOrExit(message: string, declineHint?: string): Promise<void> {
    const answer = await confirm(message);
    if (answer === "cancel") {
        exitCancelled();
    }
    if (answer === "no") {
        exitDeclined(declineHint);
    }
}
