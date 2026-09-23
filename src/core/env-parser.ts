import { readFile } from "node:fs/promises";
import { errors } from "../utils/errors";
import { HEADER_SEPARATOR } from "./constants";
import type { EnvLine, EnvVariable, ParseResult, Quote } from "./types";

/**
 * Strip env2op/op2env header blocks from content
 * Headers are delimited by separator lines
 */
export function stripHeaders(content: string): string {
    const lines = content.split("\n");
    const result: string[] = [];
    let inHeader = false;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === HEADER_SEPARATOR) {
            if (!inHeader) {
                // Starting a header block
                inHeader = true;
            } else {
                // Ending a header block
                inHeader = false;
            }
            continue;
        }

        if (!inHeader) {
            result.push(line);
        }
    }

    // Remove leading empty lines left after stripping header
    while (result.length > 0 && result[0]?.trim() === "") {
        result.shift();
    }

    return result.join("\n");
}

export interface ParsedValue {
    value: string;
    /** Quote that wrapped the value, if any */
    quote?: Quote;
    /**
     * Index in the raw text where an inline comment starts, including the whitespace before it,
     * so `raw.slice(commentStart)` is the comment as written
     */
    commentStart?: number;
}

/**
 * Parse the text after `KEY=` into its value and any inline comment
 *
 * A quoted value ends at the first matching quote followed only by whitespace or a comment, as
 * dotenv reads it: `"{"x":1}"` is `{"x":1}`, while `"a" # say "hi"` is `a`. Unquoted, `#` starts
 * a comment only after whitespace, so `#336699` stays a value.
 */
export function parseValue(raw: string): ParsedValue {
    const start = raw.length - raw.trimStart().length;
    const body = raw.slice(start);

    for (const quote of ['"', "'"] as const) {
        if (!body.startsWith(quote)) {
            continue;
        }
        let firstEnd = -1;
        for (let end = body.indexOf(quote, 1); end !== -1; end = body.indexOf(quote, end + 1)) {
            if (firstEnd === -1) {
                firstEnd = end;
            }
            const rest = body.slice(end + 1);
            if (/^\s*(#.*)?$/.test(rest)) {
                const value = body.slice(1, end);
                return rest.trim() ? { value, quote, commentStart: start + end + 1 } : { value, quote };
            }
        }
        // Text follows every closing quote: keep the value up to the first one
        if (firstEnd !== -1) {
            return { value: body.slice(1, firstEnd), quote };
        }
    }

    // Split before trimming, so that `KEY=   # note` is an empty value with a comment,
    // not the value "# note"
    const comment = /\s+#/.exec(raw);
    if (comment) {
        return { value: raw.slice(0, comment.index).trim(), commentStart: comment.index };
    }
    return { value: raw.trim() };
}

/**
 * Strip UTF-8 BOM (Byte Order Mark) from content if present
 * Common on Windows-created files
 */
export function stripBom(content: string): string {
    if (content.charCodeAt(0) === 0xfeff) {
        return content.slice(1);
    }
    return content;
}

/**
 * Parse an .env file and extract environment variables
 *
 * @param filePath - Path to the .env file
 * @returns ParseResult containing variables and any errors
 * @throws Env2OpError if file not found
 */
export async function parseEnvFile(filePath: string): Promise<ParseResult> {
    let rawContent: string;
    try {
        rawContent = await readFile(filePath, "utf-8");
    } catch {
        throw errors.envFileNotFound(filePath);
    }

    return parseEnvText(rawContent);
}

/**
 * Parse the text of an .env file: strips a BOM and any env2op/op2env header, then reads
 * each line. Quoted values follow dotenv's rules (see parseValue).
 *
 * @param rawContent - The file's contents
 * @returns ParseResult containing variables and any errors
 */
export function parseEnvText(rawContent: string): ParseResult {
    const content = stripHeaders(stripBom(rawContent));
    const rawLines = content.split("\n");
    const variables: EnvVariable[] = [];
    const lines: EnvLine[] = [];
    const parseErrors: string[] = [];
    let currentComment = "";

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i] ?? "";
        const trimmed = line.trim();
        const lineNumber = i + 1;

        // Empty lines
        if (!trimmed) {
            lines.push({ type: "empty" });
            currentComment = "";
            continue;
        }

        // Comments (preserve original content including #)
        if (trimmed.startsWith("#")) {
            lines.push({ type: "comment", content: line });
            currentComment = trimmed.slice(1).trim();
            continue;
        }

        // Parse KEY=VALUE
        // Key must start with letter or underscore, followed by letters, numbers, or underscores
        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

        if (match?.[1]) {
            const key = match[1];
            const rawValue = match[2] ?? "";
            const { value, quote, commentStart } = parseValue(rawValue);
            const inlineComment = commentStart === undefined ? undefined : rawValue.slice(commentStart);

            variables.push({
                key,
                value,
                comment: currentComment || undefined,
                line: lineNumber,
            });

            lines.push({
                type: "variable",
                key,
                value,
                ...(quote && { quote }),
                ...(inlineComment && { inlineComment }),
            });
            currentComment = "";
        } else if (trimmed.includes("=")) {
            // Line has = but doesn't match valid key format
            parseErrors.push(`Line ${lineNumber}: Invalid variable name`);
        }
        // Lines without = are silently ignored (could be malformed or intentional)
    }

    return { variables, lines, errors: parseErrors };
}

/**
 * Validate that the parsed result has variables
 *
 * @param result - ParseResult from parseEnvFile
 * @param filePath - Original file path for error message
 * @throws Env2OpError if no variables found
 */
export function validateParseResult(result: ParseResult, filePath: string): void {
    if (result.variables.length === 0) {
        throw errors.envFileEmpty(filePath);
    }
}
