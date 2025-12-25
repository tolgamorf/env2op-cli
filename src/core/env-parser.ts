import { existsSync, readFileSync } from "node:fs";
import { errors } from "../utils/errors";
import type { EnvLine, EnvVariable, ParseResult } from "./types";

/**
 * Parse a value from an environment variable line
 * Handles quoted strings and inline comments
 */
function parseValue(raw: string): string {
	const trimmed = raw.trim();

	// Handle double-quoted values
	if (trimmed.startsWith('"')) {
		const endQuote = trimmed.indexOf('"', 1);
		if (endQuote !== -1) {
			return trimmed.slice(1, endQuote);
		}
	}

	// Handle single-quoted values
	if (trimmed.startsWith("'")) {
		const endQuote = trimmed.indexOf("'", 1);
		if (endQuote !== -1) {
			return trimmed.slice(1, endQuote);
		}
	}

	// Handle unquoted values with potential inline comments
	// Only treat # as comment if preceded by whitespace
	const parts = trimmed.split(/\s+#/);
	return (parts[0] ?? trimmed).trim();
}

/**
 * Parse an .env file and extract environment variables
 *
 * @param filePath - Path to the .env file
 * @returns ParseResult containing variables and any errors
 * @throws Env2OpError if file not found
 */
export function parseEnvFile(filePath: string): ParseResult {
	if (!existsSync(filePath)) {
		throw errors.envFileNotFound(filePath);
	}

	const content = readFileSync(filePath, "utf-8");
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
			const value = parseValue(rawValue);

			variables.push({
				key,
				value,
				comment: currentComment || undefined,
				line: lineNumber,
			});

			lines.push({ type: "variable", key, value });
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
export function validateParseResult(
	result: ParseResult,
	filePath: string,
): void {
	if (result.variables.length === 0) {
		throw errors.envFileEmpty(filePath);
	}
}
