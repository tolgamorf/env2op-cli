/**
 * `op inject` is a plain-text templater, not a dotenv parser: it scans the whole
 * file for the `op://` token and has no concept of comments. A comment that only
 * *mentions* the prefix — "these are literals rather than op:// references." —
 * makes it fail with
 *
 *     invalid secret reference 'op://references.': too few '/'
 *
 * because it skips the whitespace and swallows the next word. A bare `op://` at
 * end of line fails the same way, and there is no escape syntax — a leading
 * backslash does not help.
 *
 * So mask the prefix inside comments before handing the template to op, then
 * unmask it in op's output. `op run --env-file` is dotenv-aware and needs none
 * of this; only the inject path does.
 */

import { parseValue } from "./env-parser";

const PREFIX = "op://";

/**
 * The mask has to be printable: op inject silently strips control characters
 * from the stream, so a sentinel built from those does not survive the round
 * trip. Collisions are ruled out per template instead - see pickMask.
 */
const MASK_BASE = "__ENV2OP_SECRET_REF__";

export interface MaskedTemplate {
    /** Template text with `op://` masked on comment lines. */
    text: string;
    /** The token that replaced the prefix - pass it back to unmaskSecretRefs. */
    mask: string;
    /** Whether anything was actually masked. */
    changed: boolean;
}

/**
 * Pick a mask that does not already occur in the template, so unmasking cannot
 * rewrite content that happened to contain the token.
 */
function pickMask(template: string): string {
    if (!template.includes(MASK_BASE)) {
        return MASK_BASE;
    }

    for (let n = 1; ; n++) {
        const candidate = `${MASK_BASE}${n}__`;
        if (!template.includes(candidate)) {
            return candidate;
        }
    }
}

/**
 * Mask `op://` in one line's comment, if it has one
 *
 * A full-line comment is masked whole. On a variable line only the inline comment
 * is, found by the same rules the parser uses: a `#` inside a quoted value is part
 * of the value, so the reference before the comment is never touched.
 */
function maskLine(line: string, mask: string): string {
    if (line.trimStart().startsWith("#")) {
        return line.replaceAll(PREFIX, mask);
    }

    const assignment = /^\s*[A-Za-z_][A-Za-z0-9_]*=/.exec(line);
    if (!assignment) {
        return line;
    }
    const valueStart = assignment[0].length;
    const { commentStart } = parseValue(line.slice(valueStart));
    if (commentStart === undefined) {
        return line;
    }
    const cut = valueStart + commentStart;
    return line.slice(0, cut) + line.slice(cut).replaceAll(PREFIX, mask);
}

/**
 * Mask `op://` in comments so `op inject` leaves them alone.
 */
export function maskSecretRefsInComments(template: string): MaskedTemplate {
    const mask = pickMask(template);

    const text = template
        .split("\n")
        .map((line) => maskLine(line, mask))
        .join("\n");

    return { text, mask, changed: text !== template };
}

/** Restore the masked prefix in op's output. */
export function unmaskSecretRefs(content: string, mask: string): string {
    return content.replaceAll(mask, PREFIX);
}
