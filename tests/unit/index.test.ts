import { describe, expect, test } from "bun:test";
import type { MaskedTemplate, ParsedValue, Quote } from "../../src/index";
import { maskSecretRefsInComments, parseEnvText, parseValue, unmaskSecretRefs } from "../../src/index";

/**
 * These are public API, so dropping one from src/index.ts must fail here.
 */
describe("package entry", () => {
    test("exports parseEnvText", () => {
        const result = parseEnvText('﻿JSON="{"x":1}" # note\n');
        expect(result.variables).toEqual([{ key: "JSON", value: '{"x":1}', line: 1 }]);
    });

    test("exports parseValue and the ParsedValue and Quote types", () => {
        const quote: Quote = '"';
        const parsed: ParsedValue = parseValue(`${quote}a${quote} # c`);
        expect(parsed).toEqual({ value: "a", quote: '"', commentStart: 3 });
    });

    test("exports maskSecretRefsInComments, unmaskSecretRefs and the MaskedTemplate type", () => {
        const masked: MaskedTemplate = maskSecretRefsInComments('KEY="op://v/i/f" # see op://docs\n');
        expect(masked.text).not.toContain("# see op://");
        expect(unmaskSecretRefs(masked.text, masked.mask)).toBe('KEY="op://v/i/f" # see op://docs\n');
    });
});
