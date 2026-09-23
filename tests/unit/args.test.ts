import { describe, expect, test } from "bun:test";
import { parseArgs } from "../../src/utils/args";

const KNOWN = ["f", "force", "dry-run", "verbose"] as const;
const ALL_FLAGS = ["f", "force", "v", "dry-run", "verbose", "secret"] as const;

describe("parseArgs", () => {
    test("splits flags, positional args and the output option", () => {
        const { flags, positional, options, errors } = parseArgs(
            [".env", "Vault", "Item", "-f", "--dry-run", "-o", "out.tpl"],
            KNOWN,
        );
        expect([...flags]).toEqual(["f", "dry-run"]);
        expect(positional).toEqual([".env", "Vault", "Item"]);
        expect(options.output).toBe("out.tpl");
        expect(errors).toEqual([]);
    });

    test("accepts --output=path", () => {
        expect(parseArgs(["--output=secrets.tpl"], KNOWN).options.output).toBe("secrets.tpl");
    });

    test("reports an unknown long flag instead of ignoring it", () => {
        // A typo like --dryrun must not fall through to a real push
        const { flags, errors } = parseArgs([".env", "--dryrun"], KNOWN);
        expect(flags.has("dry-run")).toBe(false);
        expect(errors).toEqual(["Unknown option: --dryrun"]);
    });

    test("reports an unknown short flag inside a combined group", () => {
        const { flags, errors } = parseArgs(["-fx"], KNOWN);
        expect(flags.has("f")).toBe(true);
        expect(errors).toEqual(["Unknown option: -x"]);
    });

    test("reports -o without a path", () => {
        expect(parseArgs(["-o"], KNOWN).errors).toEqual(["-o requires a path"]);
        expect(parseArgs(["--output", "-f"], KNOWN).errors).toEqual(["--output requires a path"]);
        expect(parseArgs(["--output="], KNOWN).errors).toEqual(["--output requires a path"]);
    });

    test("treats a lone dash as a positional argument", () => {
        expect(parseArgs(["-"], KNOWN).positional).toEqual(["-"]);
    });
});

describe("parseArgs value options", () => {
    test("collects positional arguments in order", () => {
        const { positional } = parseArgs([".env", "Personal", "MyApp"], ALL_FLAGS);
        expect(positional).toEqual([".env", "Personal", "MyApp"]);
    });

    test("collects long flags", () => {
        const { flags } = parseArgs(["--dry-run", "--verbose"], ALL_FLAGS);
        expect(flags.has("dry-run")).toBe(true);
        expect(flags.has("verbose")).toBe(true);
    });

    test("splits combined short flags", () => {
        const { flags } = parseArgs(["-fv"], ALL_FLAGS);
        expect(flags.has("f")).toBe(true);
        expect(flags.has("v")).toBe(true);
    });

    test("reads option values in the space-separated form", () => {
        const { options, positional } = parseArgs(["-o", "secrets.tpl", ".env"], ALL_FLAGS);
        expect(options.output).toBe("secrets.tpl");
        expect(positional).toEqual([".env"]);
    });

    test("reads option values in the equals form", () => {
        const { options } = parseArgs(["--output=secrets.tpl"], ALL_FLAGS);
        expect(options.output).toBe("secrets.tpl");
    });

    test("reads a --secret value only in the equals form", () => {
        expect(parseArgs(["--secret=auto"], ALL_FLAGS).options.secret).toBe("auto");
        // Space-separated, the word after a bare --secret stays positional
        const { flags, options, positional } = parseArgs(["--secret", "auto"], ALL_FLAGS);
        expect(options.secret).toBeUndefined();
        expect(flags.has("secret")).toBe(true);
        expect(positional).toEqual(["auto"]);
    });

    test("keeps a value only up to the first equals sign", () => {
        const { options } = parseArgs(["--output=a=b"], ALL_FLAGS);
        expect(options.output).toBe("a=b");
    });

    test("records a value option used without a value as a flag", () => {
        const { flags, options } = parseArgs(["--secret"], ALL_FLAGS);
        expect(flags.has("secret")).toBe(true);
        expect(options.secret).toBeUndefined();
    });

    test("does not swallow a following flag as a value", () => {
        const { flags, options } = parseArgs(["--secret", "--dry-run"], ALL_FLAGS);
        expect(options.secret).toBeUndefined();
        expect(flags.has("secret")).toBe(true);
        expect(flags.has("dry-run")).toBe(true);
    });

    test("does not treat an option value as positional", () => {
        const { positional } = parseArgs([".env", "Personal", "MyApp", "--secret=password"], ALL_FLAGS);
        expect(positional).toEqual([".env", "Personal", "MyApp"]);
    });

    test("does not swallow the .env path after a bare --secret", () => {
        // Scripts that put --secret before the arguments kept working before --secret took a value
        const { flags, positional } = parseArgs(["--secret", ".env", "Personal", "MyApp"], ALL_FLAGS);
        expect(flags.has("secret")).toBe(true);
        expect(positional).toEqual([".env", "Personal", "MyApp"]);
    });

    test("reports --secret= with an empty value", () => {
        expect(parseArgs(["--secret="], ALL_FLAGS).errors).toEqual(["--secret requires a value"]);
    });
});
