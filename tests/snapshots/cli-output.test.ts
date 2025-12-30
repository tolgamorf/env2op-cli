import { afterAll, beforeAll, describe, expect, setSystemTime, test } from "bun:test";
import { generateTemplateContent, generateUsageInstructions } from "../../src/core/template-generator";
import type { TemplateOptions } from "../../src/core/types";

describe("CLI output snapshots", () => {
    beforeAll(() => {
        setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
    });

    afterAll(() => {
        setSystemTime();
    });
    describe("template content", () => {
        test("generated template matches snapshot", () => {
            const options: TemplateOptions = {
                vaultId: "vault-abc123",
                itemId: "item-def456",
                variables: [
                    { key: "DATABASE_URL", value: "postgres://localhost/db", line: 1 },
                    { key: "API_KEY", value: "sk-secret", line: 2 },
                ],
                lines: [
                    { type: "comment", content: "# Database config" },
                    { type: "variable", key: "DATABASE_URL", value: "postgres://localhost/db" },
                    { type: "empty" },
                    { type: "comment", content: "# API" },
                    { type: "variable", key: "API_KEY", value: "sk-secret" },
                ],
                fieldIds: {
                    DATABASE_URL: "field-111",
                    API_KEY: "field-222",
                },
            };

            const content = generateTemplateContent(options, ".env.tpl");
            expect(content).toMatchSnapshot();
        });

        test("template with no comments matches snapshot", () => {
            const options: TemplateOptions = {
                vaultId: "v1",
                itemId: "i1",
                variables: [{ key: "KEY", value: "value", line: 1 }],
                lines: [{ type: "variable", key: "KEY", value: "value" }],
                fieldIds: { KEY: "f1" },
            };

            const content = generateTemplateContent(options, "secrets.tpl");
            expect(content).toMatchSnapshot();
        });
    });

    describe("usage instructions", () => {
        test("usage instructions match snapshot", () => {
            const instructions = generateUsageInstructions(".env.tpl");
            expect(instructions).toMatchSnapshot();
        });

        test("usage instructions with path match snapshot", () => {
            const instructions = generateUsageInstructions("/path/to/config.tpl");
            expect(instructions).toMatchSnapshot();
        });
    });
});
