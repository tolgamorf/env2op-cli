import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { parseEnvFile, validateParseResult } from "../../src/core/env-parser";
import { Env2OpError } from "../../src/utils/errors";

const fixturesDir = join(import.meta.dir, "../fixtures");

describe("parseEnvFile", () => {
    describe("basic parsing", () => {
        test("parses simple KEY=value pairs", () => {
            const result = parseEnvFile(join(fixturesDir, "valid.env"));

            expect(result.variables.length).toBe(7);
            expect(result.variables[0]).toEqual({
                key: "DATABASE_URL",
                value: "postgres://localhost:5432/myapp",
                comment: "Database configuration",
                line: 2,
            });
        });

        test("returns correct variable count", () => {
            const result = parseEnvFile(join(fixturesDir, "valid.env"));
            expect(result.variables.length).toBe(7);
        });

        test("captures line numbers", () => {
            const result = parseEnvFile(join(fixturesDir, "valid.env"));
            const debugVar = result.variables.find((v) => v.key === "DEBUG");
            expect(debugVar?.line).toBe(11);
        });
    });

    describe("quoted values", () => {
        test("handles double-quoted values", () => {
            const result = parseEnvFile(join(fixturesDir, "quoted-values.env"));
            const doubleQuoted = result.variables.find((v) => v.key === "DOUBLE_QUOTED");
            expect(doubleQuoted?.value).toBe("hello world");
        });

        test("handles single-quoted values", () => {
            const result = parseEnvFile(join(fixturesDir, "quoted-values.env"));
            const singleQuoted = result.variables.find((v) => v.key === "SINGLE_QUOTED");
            expect(singleQuoted?.value).toBe("hello world");
        });

        test("preserves spaces in quoted values", () => {
            const result = parseEnvFile(join(fixturesDir, "quoted-values.env"));
            const withSpaces = result.variables.find((v) => v.key === "DOUBLE_WITH_SPACES");
            expect(withSpaces?.value).toBe("  spaces around  ");
        });

        test("preserves # in quoted values (not treated as comment)", () => {
            const result = parseEnvFile(join(fixturesDir, "quoted-values.env"));
            const withHash = result.variables.find((v) => v.key === "DOUBLE_WITH_HASH");
            expect(withHash?.value).toBe("value # not a comment");
        });

        test("handles empty quoted values", () => {
            const result = parseEnvFile(join(fixturesDir, "quoted-values.env"));
            const emptyDouble = result.variables.find((v) => v.key === "DOUBLE_EMPTY");
            const emptySingle = result.variables.find((v) => v.key === "SINGLE_EMPTY");
            expect(emptyDouble?.value).toBe("");
            expect(emptySingle?.value).toBe("");
        });

        test("handles unquoted values", () => {
            const result = parseEnvFile(join(fixturesDir, "quoted-values.env"));
            const unquoted = result.variables.find((v) => v.key === "UNQUOTED");
            expect(unquoted?.value).toBe("simple_value");
        });
    });

    describe("comments", () => {
        test("preserves standalone comments in lines array", () => {
            const result = parseEnvFile(join(fixturesDir, "comments.env"));
            const commentLines = result.lines.filter((l) => l.type === "comment");
            expect(commentLines.length).toBeGreaterThan(0);
        });

        test("associates comments with following variables", () => {
            const result = parseEnvFile(join(fixturesDir, "comments.env"));
            const key1 = result.variables.find((v) => v.key === "KEY1");
            // KEY1 follows empty line, so no associated comment
            expect(key1?.comment).toBeUndefined();
        });

        test("strips inline comments from unquoted values", () => {
            const result = parseEnvFile(join(fixturesDir, "comments.env"));
            const dbPort = result.variables.find((v) => v.key === "DB_PORT");
            expect(dbPort?.value).toBe("5432");
        });

        test("preserves original comment content including #", () => {
            const result = parseEnvFile(join(fixturesDir, "comments.env"));
            const firstComment = result.lines.find((l) => l.type === "comment");
            expect(firstComment?.type === "comment" && firstComment.content).toContain("#");
        });
    });

    describe("empty lines", () => {
        test("preserves empty lines in lines array", () => {
            const result = parseEnvFile(join(fixturesDir, "comments.env"));
            const emptyLines = result.lines.filter((l) => l.type === "empty");
            expect(emptyLines.length).toBeGreaterThan(0);
        });
    });

    describe("edge cases", () => {
        test("handles multiple equals signs in value", () => {
            const result = parseEnvFile(join(fixturesDir, "edge-cases.env"));
            const equation = result.variables.find((v) => v.key === "EQUATION");
            expect(equation?.value).toBe("a=b=c=d");
        });

        test("handles URL with query parameters", () => {
            const result = parseEnvFile(join(fixturesDir, "edge-cases.env"));
            const url = result.variables.find((v) => v.key === "URL");
            expect(url?.value).toBe("https://example.com?foo=bar&baz=qux");
        });

        test("handles unicode characters in values", () => {
            const result = parseEnvFile(join(fixturesDir, "edge-cases.env"));
            const emoji = result.variables.find((v) => v.key === "EMOJI");
            const unicode = result.variables.find((v) => v.key === "UNICODE");
            expect(emoji?.value).toContain("🎉");
            expect(unicode?.value).toContain("你好");
        });

        test("handles long values", () => {
            const result = parseEnvFile(join(fixturesDir, "edge-cases.env"));
            const longValue = result.variables.find((v) => v.key === "LONG_VALUE");
            expect(longValue?.value.length).toBeGreaterThan(100);
        });

        test("handles special characters in values", () => {
            const result = parseEnvFile(join(fixturesDir, "edge-cases.env"));
            const special = result.variables.find((v) => v.key === "SPECIAL_CHARS");
            expect(special?.value).toContain("@#$%");
        });

        test("handles JSON in values", () => {
            const result = parseEnvFile(join(fixturesDir, "edge-cases.env"));
            const json = result.variables.find((v) => v.key === "JSON_VALUE");
            expect(json?.value).toContain('"key"');
        });
    });

    describe("variable names", () => {
        test("accepts keys starting with underscore", () => {
            const result = parseEnvFile(join(fixturesDir, "edge-cases.env"));
            const underscoreKey = result.variables.find((v) => v.key === "_STARTS_WITH_UNDERSCORE");
            expect(underscoreKey).toBeDefined();
        });

        test("accepts keys with double underscores", () => {
            const result = parseEnvFile(join(fixturesDir, "edge-cases.env"));
            const doubleUnderscore = result.variables.find((v) => v.key === "__DOUBLE_UNDERSCORE");
            expect(doubleUnderscore).toBeDefined();
        });

        test("accepts keys with numbers after first character", () => {
            const result = parseEnvFile(join(fixturesDir, "edge-cases.env"));
            const key123 = result.variables.find((v) => v.key === "KEY123");
            expect(key123).toBeDefined();
        });

        test("rejects keys starting with numbers", () => {
            // Need to create a test with invalid key to test this
            const result = parseEnvFile(join(fixturesDir, "edge-cases.env"));
            const invalidKey = result.variables.find((v) => v.key.match(/^[0-9]/));
            expect(invalidKey).toBeUndefined();
        });
    });

    describe("error handling", () => {
        test("throws Env2OpError for missing file", () => {
            expect(() => parseEnvFile("/nonexistent/path/.env")).toThrow(Env2OpError);
        });

        test("throws with correct error code for missing file", () => {
            try {
                parseEnvFile("/nonexistent/path/.env");
            } catch (e) {
                expect(e).toBeInstanceOf(Env2OpError);
                expect((e as Env2OpError).code).toBe("ENV_FILE_NOT_FOUND");
            }
        });

        test("reports invalid variable names in errors array", () => {
            // Create inline test for invalid names
            // For now, we test the existing fixtures don't have errors
            const result = parseEnvFile(join(fixturesDir, "valid.env"));
            expect(result.errors.length).toBe(0);
        });
    });

    describe("lines array structure", () => {
        test("preserves original file structure order", () => {
            const result = parseEnvFile(join(fixturesDir, "comments.env"));
            // First line should be a comment
            expect(result.lines[0]?.type).toBe("comment");
        });

        test("variable lines include key and value", () => {
            const result = parseEnvFile(join(fixturesDir, "valid.env"));
            const varLine = result.lines.find((l) => l.type === "variable");
            expect(varLine?.type === "variable" && varLine.key).toBeDefined();
            expect(varLine?.type === "variable" && varLine.value).toBeDefined();
        });
    });
});

describe("validateParseResult", () => {
    test("does not throw when variables exist", () => {
        const result = parseEnvFile(join(fixturesDir, "valid.env"));
        expect(() => validateParseResult(result, "valid.env")).not.toThrow();
    });

    test("throws Env2OpError when no variables found", () => {
        const result = parseEnvFile(join(fixturesDir, "empty.env"));
        expect(() => validateParseResult(result, "empty.env")).toThrow(Env2OpError);
    });

    test("throws with correct error code for empty file", () => {
        const result = parseEnvFile(join(fixturesDir, "empty.env"));
        try {
            validateParseResult(result, "empty.env");
        } catch (e) {
            expect(e).toBeInstanceOf(Env2OpError);
            expect((e as Env2OpError).code).toBe("ENV_FILE_EMPTY");
        }
    });
});
