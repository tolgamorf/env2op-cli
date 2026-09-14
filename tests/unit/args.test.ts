import { describe, expect, test } from "bun:test";
import { parseArgs } from "../../src/utils/args";

describe("parseArgs", () => {
    test("collects positional arguments in order", () => {
        const { positional } = parseArgs([".env", "Personal", "MyApp"]);
        expect(positional).toEqual([".env", "Personal", "MyApp"]);
    });

    test("collects long flags", () => {
        const { flags } = parseArgs(["--dry-run", "--verbose"]);
        expect(flags.has("dry-run")).toBe(true);
        expect(flags.has("verbose")).toBe(true);
    });

    test("splits combined short flags", () => {
        const { flags } = parseArgs(["-fv"]);
        expect(flags.has("f")).toBe(true);
        expect(flags.has("v")).toBe(true);
    });

    test("reads option values in the space-separated form", () => {
        const { options, positional } = parseArgs(["-o", "secrets.tpl", ".env"]);
        expect(options.output).toBe("secrets.tpl");
        expect(positional).toEqual([".env"]);
    });

    test("reads option values in the equals form", () => {
        const { options } = parseArgs(["--output=secrets.tpl"]);
        expect(options.output).toBe("secrets.tpl");
    });

    test("reads --secret in both forms", () => {
        expect(parseArgs(["--secret=auto"]).options.secret).toBe("auto");
        expect(parseArgs(["--secret", "auto"]).options.secret).toBe("auto");
    });

    test("keeps a value only up to the first equals sign", () => {
        const { options } = parseArgs(["--output=a=b"]);
        expect(options.output).toBe("a=b");
    });

    test("records a value option used without a value as a flag", () => {
        const { flags, options } = parseArgs(["--secret"]);
        expect(flags.has("secret")).toBe(true);
        expect(options.secret).toBeUndefined();
    });

    test("does not swallow a following flag as a value", () => {
        const { flags, options } = parseArgs(["--secret", "--dry-run"]);
        expect(options.secret).toBeUndefined();
        expect(flags.has("secret")).toBe(true);
        expect(flags.has("dry-run")).toBe(true);
    });

    test("does not treat an option value as positional", () => {
        const { positional } = parseArgs([".env", "Personal", "MyApp", "--secret", "password"]);
        expect(positional).toEqual([".env", "Personal", "MyApp"]);
    });
});
