import { describe, expect, test } from "bun:test";
import { HEADER_SEPARATOR } from "../../src/core/constants";
import {
    generateTemplateContent,
    generateUsageInstructions,
    refreshEnvHeader,
} from "../../src/core/template-generator";
import type { TemplateOptions } from "../../src/core/types";

describe("generateTemplateContent", () => {
    const createOptions = (overrides: Partial<TemplateOptions> = {}): TemplateOptions => ({
        vaultId: "vault123",
        itemId: "item456",
        lines: [
            { type: "variable", key: "KEY1", value: "value1" },
            { type: "variable", key: "KEY2", value: "value2" },
        ],
        fieldIds: {
            KEY1: "field1",
            KEY2: "field2",
        },
        ...overrides,
    });

    test("generates correct op:// references", () => {
        const options = createOptions();
        const content = generateTemplateContent(options, ".env.tpl");

        expect(content).toContain("KEY1=op://vault123/item456/field1");
        expect(content).toContain("KEY2=op://vault123/item456/field2");
    });

    test("uses field IDs in references", () => {
        const options = createOptions({
            fieldIds: {
                KEY1: "abc123",
                KEY2: "def456",
            },
        });
        const content = generateTemplateContent(options, ".env.tpl");

        expect(content).toContain("op://vault123/item456/abc123");
        expect(content).toContain("op://vault123/item456/def456");
    });

    test("falls back to key name when fieldId is missing", () => {
        const options = createOptions({
            fieldIds: {}, // No field IDs
        });
        const content = generateTemplateContent(options, ".env.tpl");

        // Should use key name as fallback
        expect(content).toContain("KEY1=op://vault123/item456/KEY1");
    });

    test("writes an empty value as a literal empty assignment, not a reference", () => {
        // 1Password holds no empty field, so a reference could never resolve; and dropping the
        // line would let a layered env file inherit the value it was overriding with empty.
        const content = generateTemplateContent(
            createOptions({
                lines: [
                    { type: "comment", content: "# Empty on purpose: no mail locally." },
                    { type: "variable", key: "COURIER_API_KEY", value: "" },
                    { type: "variable", key: "KEY1", value: "value1" },
                ],
                fieldIds: { COURIER_API_KEY: "f-empty", KEY1: "field1" },
            }),
            ".env.tpl",
        );

        expect(content).toContain(
            "# Empty on purpose: no mail locally.\nCOURIER_API_KEY=\nKEY1=op://vault123/item456/field1",
        );
        expect(content).not.toContain("COURIER_API_KEY=op://");
    });

    test("switches between literal empty and reference as the value is filled in or cleared", () => {
        // Each push regenerates the template from the current .env and the field IDs 1Password
        // returned, so nothing from an earlier push where the value was empty carries over.
        const push = (value: string, fieldIds: Record<string, string>) =>
            generateTemplateContent(
                createOptions({ lines: [{ type: "variable", key: "COURIER_API_KEY", value }], fieldIds }),
                ".env.tpl",
            );

        expect(push("", {})).toContain("COURIER_API_KEY=\n");
        expect(push("sk_live", { COURIER_API_KEY: "f-new" })).toContain("COURIER_API_KEY=op://vault123/item456/f-new");
        expect(push("", {})).not.toContain("COURIER_API_KEY=op://");
    });

    test("quotes a reference the way the source quoted its value", () => {
        // op inject substitutes inside the quotes, so a value holding ` #` or edge spaces comes
        // back quoted and reads the same on the next push instead of losing its tail.
        const content = generateTemplateContent(
            createOptions({
                lines: [
                    { type: "variable", key: "KEY1", value: "a # b", quote: '"' },
                    { type: "variable", key: "KEY2", value: "  sp  ", quote: "'" },
                    { type: "variable", key: "KEY3", value: "", quote: '"' },
                ],
                fieldIds: { KEY1: "field1", KEY2: "field2" },
            }),
            ".env.tpl",
        );

        expect(content).toContain('KEY1="op://vault123/item456/field1"\n');
        expect(content).toContain("KEY2='op://vault123/item456/field2'\n");
        expect(content).toContain("KEY3=\n");
    });

    test("keeps inline comments, quoting a reference that one follows", () => {
        // Unquoted, op inject eats the space before the #, and `val# c` reads back as the value
        const content = generateTemplateContent(
            createOptions({
                lines: [
                    { type: "variable", key: "KEY1", value: "v", inlineComment: " # plain" },
                    { type: "variable", key: "KEY2", value: "v", quote: "'", inlineComment: "  # quoted" },
                    { type: "variable", key: "KEY3", value: "", quote: '"', inlineComment: " # empty" },
                ],
            }),
            ".env.tpl",
        );

        expect(content).toContain('KEY1="op://vault123/item456/field1" # plain\n');
        expect(content).toContain("KEY2='op://vault123/item456/field2'  # quoted\n");
        expect(content).toContain("KEY3= # empty\n");
    });

    test("includes version header", () => {
        const options = createOptions();
        const content = generateTemplateContent(options, ".env.tpl");

        expect(content).toMatch(/#\s+Generated by env2op v[\d.]+/);
    });

    test("includes separator lines", () => {
        const options = createOptions();
        const content = generateTemplateContent(options, ".env.tpl");

        expect(content).toContain("# ===========================================================================");
    });

    test("includes template description", () => {
        const options = createOptions();
        const content = generateTemplateContent(options, ".env.tpl");

        expect(content).toContain("1Password Secret References");
        expect(content).toContain("only references to them");
    });

    test("includes repository link", () => {
        const options = createOptions();
        const content = generateTemplateContent(options, ".env.tpl");

        expect(content).toContain("https://github.com/tolgamorf/env2op-cli");
    });

    test("includes usage instructions with template filename", () => {
        const options = createOptions();
        const content = generateTemplateContent(options, "secrets.tpl");

        expect(content).toContain("op2env secrets.tpl");
        expect(content).toContain("op run --env-file secrets.tpl");
    });

    test("preserves empty lines", () => {
        const options = createOptions({
            lines: [
                { type: "variable", key: "KEY1", value: "value1" },
                { type: "empty" },
                { type: "variable", key: "KEY2", value: "value2" },
            ],
        });
        const content = generateTemplateContent(options, ".env.tpl");
        const lines = content.split("\n");

        // Find the empty line between variables (after header)
        const key1Index = lines.findIndex((l) => l.includes("KEY1="));
        const key2Index = lines.findIndex((l) => l.includes("KEY2="));

        // There should be an empty line between them
        expect(key2Index - key1Index).toBe(2);
    });

    test("preserves comments", () => {
        const options = createOptions({
            lines: [
                { type: "comment", content: "# Database config" },
                { type: "variable", key: "KEY1", value: "value1" },
            ],
        });
        const content = generateTemplateContent(options, ".env.tpl");

        expect(content).toContain("# Database config");
    });

    test("ends with newline", () => {
        const options = createOptions();
        const content = generateTemplateContent(options, ".env.tpl");

        expect(content.endsWith("\n")).toBe(true);
    });
});

describe("generateUsageInstructions", () => {
    test("includes op2env command", () => {
        const instructions = generateUsageInstructions(".env.tpl");
        expect(instructions).toContain("op2env .env.tpl");
    });

    test("includes op run command", () => {
        const instructions = generateUsageInstructions(".env.tpl");
        expect(instructions).toContain("op run --env-file .env.tpl");
    });

    test("uses provided template path", () => {
        const instructions = generateUsageInstructions("/path/to/secrets.tpl");
        expect(instructions).toContain("op2env /path/to/secrets.tpl");
    });
});

describe("refreshEnvHeader", () => {
    const body = "KEY1=value1\n\n# a user comment\nKEY2=value2\n";

    const oldHeader = [
        HEADER_SEPARATOR,
        "#  .env — Environment Variables",
        "#",
        "#  Pulled: 2020-01-01 00:00:00 UTC",
        HEADER_SEPARATOR,
        "",
        "",
    ].join("\n");

    const countSeparators = (content: string): number =>
        content.split("\n").filter((line) => line.trim() === HEADER_SEPARATOR).length;

    test("replaces an existing header, refreshing the Pulled stamp", () => {
        const result = refreshEnvHeader(oldHeader + body, ".env");

        expect(result).not.toContain("2020-01-01");
        expect(result).toMatch(/^#\s+Pulled: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/m);
        expect(countSeparators(result)).toBe(2);
    });

    test("keeps body content intact outside the header", () => {
        const result = refreshEnvHeader(oldHeader + body, ".env");

        expect(result.endsWith(body)).toBe(true);
    });

    test("adds a header to a file that never had one", () => {
        const result = refreshEnvHeader(body, ".env");

        expect(result.startsWith(HEADER_SEPARATOR)).toBe(true);
        expect(result).toMatch(/^#\s+Pulled: /m);
        expect(result.endsWith(body)).toBe(true);
    });

    test("names the file and its template in the header", () => {
        const result = refreshEnvHeader(body, ".env.deploy.local");

        expect(result).toContain(".env.deploy.local — Environment Variables");
        expect(result).toContain("env2op .env.deploy.local");
    });

    test("strips a UTF-8 BOM so the old header is recognized", () => {
        const result = refreshEnvHeader(`\uFEFF${oldHeader}${body}`, ".env");

        expect(result).not.toContain("\uFEFF");
        expect(countSeparators(result)).toBe(2);
    });
});
