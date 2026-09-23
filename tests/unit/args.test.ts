import { describe, expect, test } from "bun:test";
import { parseArgs } from "../../src/utils/args";

const KNOWN = ["f", "force", "dry-run", "verbose"] as const;

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
