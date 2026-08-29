import { describe, expect, test } from "bun:test";
import { maskSecretRefsInComments, unmaskSecretRefs } from "../../src/core/secret-refs";

const REF = "op://vault/item/field";

/** Mask, then unmask with the token that masking chose. */
function roundTrip(template: string): string {
    const masked = maskSecretRefsInComments(template);
    return unmaskSecretRefs(masked.text, masked.mask);
}

describe("maskSecretRefsInComments", () => {
    test("masks op:// mentioned in a comment", () => {
        const masked = maskSecretRefsInComments("# these are literals rather than op:// references.");
        expect(masked.text).not.toContain("op://");
    });

    test("masks a bare op:// at end of a comment", () => {
        expect(maskSecretRefsInComments("# see op://").text).not.toContain("op://");
    });

    test("masks every occurrence on the same comment line", () => {
        expect(maskSecretRefsInComments("# op:// and op:// again").text).not.toContain("op://");
    });

    test("masks indented comments", () => {
        expect(maskSecretRefsInComments("    # indented op:// mention").text).not.toContain("op://");
    });

    test("uses a printable mask - op inject strips control characters", () => {
        const { mask } = maskSecretRefsInComments("# op:// mention");
        const printable = [...mask].every((char) => {
            const code = char.charCodeAt(0);
            return code >= 0x20 && code < 0x7f;
        });

        expect(printable).toBe(true);
    });

    test("picks a mask that does not already occur in the template", () => {
        const { mask } = maskSecretRefsInComments("# op:// mention\nTOKEN=__ENV2OP_SECRET_REF__\n");
        expect(mask).not.toBe("__ENV2OP_SECRET_REF__");
    });

    test("leaves references on variable lines alone", () => {
        const { text } = maskSecretRefsInComments(`# a comment about op:// refs\nNODE_ENV=${REF}\n`);

        expect(text).toContain(`NODE_ENV=${REF}`);
        expect(text.split("\n")[0]).not.toContain("op://");
    });

    test("does not mask a reference after an inline #", () => {
        // Masking past an inline # would neuter a real reference, because a #
        // can legitimately sit inside a quoted value.
        const line = `NOTE=${REF} # explains the value`;
        expect(maskSecretRefsInComments(line).text).toBe(line);
    });

    test("preserves content with no references at all", () => {
        const template = "# plain comment\nFOO=bar\n\nBAZ=qux\n";
        expect(maskSecretRefsInComments(template).text).toBe(template);
    });

    test("reports changed only when something was masked", () => {
        // op is handed the original template untouched when nothing needs
        // masking, so this flag decides whether a scratch file is written.
        expect(maskSecretRefsInComments("# op:// mention\nFOO=bar\n").changed).toBe(true);
        expect(maskSecretRefsInComments(`# plain comment\nNODE_ENV=${REF}\n`).changed).toBe(false);
        expect(maskSecretRefsInComments("FOO=bar\n").changed).toBe(false);
    });

    test("preserves line count and trailing newline", () => {
        const template = "# op:// mention\nFOO=bar\n";
        const { text } = maskSecretRefsInComments(template);

        expect(text.split("\n").length).toBe(template.split("\n").length);
        expect(text.endsWith("\n")).toBe(true);
    });
});

describe("unmaskSecretRefs", () => {
    test("restores what masking replaced", () => {
        const template = "# literals rather than op:// references.\n# and a bare op://\nFOO=bar\n";
        expect(roundTrip(template)).toBe(template);
    });

    test("round-trips a real template shape", () => {
        const template = [
            "# ==========================",
            "#  .env.tpl — 1Password Secret References",
            "# ==========================",
            "",
            `NODE_ENV=${REF}`,
            "",
            "# local dev values are not secrets, so these are literals",
            "# rather than op:// references.",
            "POSTGRES_HOST=localhost",
            "",
        ].join("\n");

        const masked = maskSecretRefsInComments(template);
        expect(masked.text).not.toContain("op:// references");
        expect(masked.text).toContain(`NODE_ENV=${REF}`);
        expect(unmaskSecretRefs(masked.text, masked.mask)).toBe(template);
    });

    test("leaves resolved output untouched when nothing was masked", () => {
        const { mask } = maskSecretRefsInComments("FOO=bar\n");
        const resolved = "NODE_ENV=development\nPOSTGRES_HOST=localhost\n";

        expect(unmaskSecretRefs(resolved, mask)).toBe(resolved);
    });
});
