import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    isUpdateCheckDisabled,
    maybeShowUpdateNotification,
    NO_UPDATE_CHECK_ENV,
    setUpdateCacheDirForTesting,
} from "../../src/lib/update";

describe("isUpdateCheckDisabled", () => {
    test.each(["1", "true", "yes", "TRUE", " 1 "])("is off for %p", (value) => {
        expect(isUpdateCheckDisabled({ [NO_UPDATE_CHECK_ENV]: value })).toBe(true);
    });

    test.each([undefined, "", "0", "false", "FALSE", " "])("stays on for %p", (value) => {
        expect(isUpdateCheckDisabled({ [NO_UPDATE_CHECK_ENV]: value })).toBe(false);
    });
});

/**
 * Run the notice path against a fake registry and a throwaway cache directory,
 * so nothing touches the network or the real ~/.env2op cache.
 */
describe("maybeShowUpdateNotification", () => {
    let home: string;
    let saved: { flag?: string; fetch: typeof fetch };
    let fetchCalls: number;

    beforeEach(() => {
        home = mkdtempSync(join(tmpdir(), "env2op-home-"));
        saved = { flag: process.env[NO_UPDATE_CHECK_ENV], fetch: globalThis.fetch };
        setUpdateCacheDirForTesting(join(home, ".env2op"));
        delete process.env[NO_UPDATE_CHECK_ENV];
        fetchCalls = 0;
        globalThis.fetch = (async () => {
            fetchCalls++;
            return new Response(JSON.stringify({ version: "999.0.0" }));
        }) as unknown as typeof fetch;
    });

    afterEach(() => {
        globalThis.fetch = saved.fetch;
        setUpdateCacheDirForTesting(undefined);
        if (saved.flag === undefined) {
            delete process.env[NO_UPDATE_CHECK_ENV];
        } else {
            process.env[NO_UPDATE_CHECK_ENV] = saved.flag;
        }
        rmSync(home, { recursive: true, force: true });
    });

    test("does nothing when the check is turned off: no request, no notice, no cache write", async () => {
        process.env[NO_UPDATE_CHECK_ENV] = "1";
        let notices = 0;
        await maybeShowUpdateNotification("env2op", () => notices++);

        expect(fetchCalls).toBe(0);
        expect(notices).toBe(0);
        expect(existsSync(join(home, ".env2op"))).toBe(false);
    });

    test("checks, caches and shows the notice when the variable is unset", async () => {
        let shown: string | null = null;
        await maybeShowUpdateNotification("op2env", (result, cliName) => {
            shown = `${cliName} ${result.latestVersion}`;
        });

        expect(fetchCalls).toBe(1);
        expect(shown).toBe("op2env 999.0.0");
        expect(existsSync(join(home, ".env2op", "update-check.json"))).toBe(true);
    });
});
