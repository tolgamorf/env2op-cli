// Folder naming conventions, the one thing Biome's linter cannot check.
//
// `style/useFilenamingConvention` only ever looks at a file's basename - the rule docs never mention
// directories, and its `match` regex is tested against the basename too. Nothing else in Biome's
// rule set is path-aware. So when eslint-plugin-check-file went, its `folder-naming-convention` rule
// had nowhere to land and became this script instead.
//
// SHARED ACROSS HETGE REPOS. This file is byte-identical in every hetge repo that runs it (Next.js
// apps, CLIs, infra). It carries no per-repo configuration: a root that does not exist in a checkout
// is simply not walked, so the lists below are supersets by design. Change it in one repo, then copy
// it to all the others; never fork it.
//
// The two patterns below are ports of check-file@3.3.2's own micromatch definitions:
//
//   KEBAB_CASE              +([a-z])*([a-z0-9])*(-+([a-z0-9]))
//   CAMEL_CASE              +([a-z])*([a-z0-9])*([A-Z]*([a-z0-9]))
//   NEXT_JS_APP_ROUTER_CASE @(KEBAB|+([a-z])?(.+([a-z]))|[CAMEL]|[...CAMEL]|[[...CAMEL]]
//                             |(KEBAB)|@CAMEL|_KEBAB)
//
// plus one shape check-file predates: intercepting-route markers `(.)`, `(..)`, `(..)(..)`, `(...)`
// prefixed to any ordinary segment.
//
// Note the asymmetry inherited from check-file: dynamic segments take camelCase inside the brackets
// (`[designId]`) while route groups take kebab-case inside the parens (`(editor)`).

import { readdirSync } from "node:fs";
import { basename, join, posix, sep } from "node:path";

const KEBAB = "[a-z]+[a-z0-9]*(?:-[a-z0-9]+)*";
const CAMEL = "[a-z]+[a-z0-9]*(?:[A-Z][a-z0-9]*)*";

// An ordinary route segment - the shapes check-file recognised - factored out so the intercepting-route
// marker can prefix any of them without repeating the alternation.
const SEGMENT =
    `(?:${KEBAB}` + // plain segment
    "|[a-z]+(?:\\.[a-z]+)?" + // dotted lowercase segment
    `|\\[${CAMEL}\\]` + // [param]
    `|\\[\\.\\.\\.${CAMEL}\\]` + // [...rest]
    `|\\[\\[\\.\\.\\.${CAMEL}\\]\\])`; // [[...optionalRest]]

// Intercepting-route markers (intercepting-routes.md): `(.)` same level, `(..)` one level up,
// `(..)(..)` two levels up, `(...)` from the app root.
const INTERCEPT_MARKER = "(?:\\(\\.\\)|\\(\\.\\.\\)|\\(\\.\\.\\)\\(\\.\\.\\)|\\(\\.\\.\\.\\))";

const KEBAB_CASE = new RegExp(`^${KEBAB}$`);

const NEXT_JS_APP_ROUTER_CASE = new RegExp(
    `^(?:${SEGMENT}` +
        `|\\(${KEBAB}\\)` + // (route-group)
        `|@${CAMEL}` + // @slot
        `|_${KEBAB}` + // _private
        `|${INTERCEPT_MARKER}${SEGMENT})$`, // (.)intercepted-segment
);

const APP_ROUTER = { pattern: NEXT_JS_APP_ROUTER_CASE, label: "the Next.js App Router naming convention" };
const PLAIN = { pattern: KEBAB_CASE, label: "kebab-case" };

// Every root any hetge repo declares, plus `src` for the src-layout repos (CLIs, libraries, infra).
// As in check-file, the root itself is not checked - only the segments beneath it.
const ROOTS = [
    "app",
    "bootstrap",
    "components",
    "context",
    "contexts",
    "features",
    "hooks",
    "lib",
    "models",
    "providers",
    "services",
    "src",
    "stores",
    "types",
    "utils",
];

// Build output and dependency trees: never entered.
const SKIP = new Set(["node_modules", ".next", "dist", "build", "coverage", "out"]);

// Test-tooling idioms (vitest/jest): the NAME is exempt, but what is nested under it still has to
// comply - which is why these are not SKIP entries. The successor to check-file's `ignoreWords`.
const IGNORE_WORDS = new Set(["__tests__", "__fixtures__", "__mocks__", "__snapshots__"]);

/**
 * `app/` at the project root, or `src/app/`, is a Next.js App Router tree; everything else is plain
 * kebab-case.
 *
 * @param {string} path posix-style path relative to the project root
 */
function conventionFor(path) {
    return path.startsWith("app/") || path.startsWith("src/app/") ? APP_ROUTER : PLAIN;
}

/**
 * Collect every directory beneath `dir`, depth-first, skipping build output and dot-directories.
 *
 * @param {string} dir
 * @returns {string[]} posix-style paths relative to the project root
 */
function walk(dir) {
    /** @type {string[]} */
    const found = [];

    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return found; // root does not exist in this checkout
    }

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".") || SKIP.has(entry.name)) {
            continue;
        }
        const child = join(dir, entry.name).split(sep).join(posix.sep);
        found.push(child);
        found.push(...walk(child));
    }

    return found;
}

/** @type {string[]} */
const violations = [];

for (const root of ROOTS) {
    for (const path of walk(root)) {
        const name = basename(path);
        if (IGNORE_WORDS.has(name)) {
            continue;
        }
        const { pattern, label } = conventionFor(path);
        if (!pattern.test(name)) {
            violations.push(`  ✗ ${path} - must be ${label}`);
        }
    }
}

if (violations.length > 0) {
    console.error(`\nFolder naming convention (${violations.length} violation${violations.length > 1 ? "s" : ""}):\n`);
    console.error(violations.join("\n"));
    console.error("");
    process.exit(1);
}
