import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVault, determineFieldType, getOpStatus, itemExists, vaultExists } from "../../src/core/onepassword";
import { parseSecretType, SecretType } from "../../src/core/types";
import { Env2OpError } from "../../src/utils/errors";

/**
 * Put a fake `op` first on PATH that runs the given shell body, so the failure paths
 * run against a real spawned process rather than a mock.
 */
let binDir: string;
let originalPath: string | undefined;

function fakeOp(body: string): void {
    const script = join(binDir, "op");
    writeFileSync(script, `#!/bin/sh\n${body}\n`);
    chmodSync(script, 0o755);
}

beforeEach(() => {
    binDir = mkdtempSync(join(tmpdir(), "env2op-fake-op-"));
    originalPath = process.env.PATH;
    process.env.PATH = `${binDir}:${originalPath}`;
});

afterEach(() => {
    process.env.PATH = originalPath;
    rmSync(binDir, { recursive: true, force: true });
});

describe.skipIf(process.platform === "win32")("onepassword against a fake op", () => {
    test("a failed item listing throws instead of reading as 'not found'", async () => {
        // Reading it as "not found" would make env2op create a duplicate item
        fakeOp('echo "session expired" >&2; exit 1');
        const error = await itemExists("Vault", "Item").catch((e) => e);
        expect(error).toBeInstanceOf(Env2OpError);
        expect((error as Env2OpError).code).toBe("OP_COMMAND_FAILED");
        expect((error as Env2OpError).message).toContain("session expired");
    });

    test("a failed vault listing throws instead of reading as 'not found'", async () => {
        fakeOp('echo "network down" >&2; exit 1');
        const error = await vaultExists("Vault").catch((e) => e);
        expect((error as Env2OpError).code).toBe("OP_COMMAND_FAILED");
    });

    test("finds an item and a vault from op's listing", async () => {
        fakeOp(`case "$1" in
  item) echo '[{"id":"i1","title":"Other"},{"id":"i2","title":"Item"}]' ;;
  vault) echo '[{"name":"Vault"}]' ;;
esac`);
        expect(await itemExists("Vault", "Item")).toBe("i2");
        expect(await itemExists("Vault", "Missing")).toBeNull();
        expect(await vaultExists("Vault")).toBe(true);
        expect(await vaultExists("Nope")).toBe(false);
    });

    test("a failed vault create throws", async () => {
        fakeOp('echo "permission denied" >&2; exit 1');
        const error = await createVault("New").catch((e) => e);
        expect((error as Env2OpError).code).toBe("VAULT_CREATE_FAILED");
        expect((error as Env2OpError).message).toContain("permission denied");
    });

    test("getOpStatus tells a missing op from a signed-out one", async () => {
        fakeOp("exit 1");
        expect(await getOpStatus()).toBe("signed-out");
        fakeOp("echo '{}'");
        expect(await getOpStatus()).toBe("ready");
        process.env.PATH = binDir;
        rmSync(join(binDir, "op"));
        expect(await getOpStatus()).toBe("missing");
    });
});

describe("determineFieldType", () => {
    test("conceals every field for the password type", () => {
        expect(determineFieldType("DEBUG", SecretType.password)).toBe("CONCEALED");
        expect(determineFieldType("API_KEY", SecretType.password)).toBe("CONCEALED");
    });

    test("reveals every field for the text type", () => {
        expect(determineFieldType("DEBUG", SecretType.text)).toBe("STRING");
        expect(determineFieldType("API_KEY", SecretType.text)).toBe("STRING");
    });

    describe("auto", () => {
        test.each(["API_KEY", "DATABASE_PASSWORD", "STRIPE_SECRET_KEY", "AUTH_TOKEN", "TLS_CERT", "ENCRYPTION_IV"])(
            "conceals %s",
            (key) => {
                expect(determineFieldType(key, SecretType.auto)).toBe("CONCEALED");
            },
        );

        test.each(["NODE_ENV", "DEBUG", "DATABASE_URL", "PORT", "LOG_LEVEL"])("reveals %s", (key) => {
            expect(determineFieldType(key, SecretType.auto)).toBe("STRING");
        });

        test("matches regardless of case", () => {
            expect(determineFieldType("api_key", SecretType.auto)).toBe("CONCEALED");
        });
    });
});

describe("parseSecretType", () => {
    test.each(Object.values(SecretType))("accepts %s", (value) => {
        expect(parseSecretType(value)).toBe(value);
    });

    test("rejects unknown values", () => {
        expect(parseSecretType("bogus")).toBeNull();
        expect(parseSecretType("")).toBeNull();
        expect(parseSecretType("TEXT")).toBeNull();
    });
});
