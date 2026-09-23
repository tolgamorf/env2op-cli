import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVault, determineFieldType, getOpStatus, itemExists, vaultExists } from "../../src/core/onepassword";
import { parseSecretType, SECRET_TYPES } from "../../src/core/types";
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
    const field = (key: string, value = "x") => ({ key, value });

    test("conceals every field for the password type", () => {
        expect(determineFieldType(field("DEBUG"), "password")).toBe("CONCEALED");
        expect(determineFieldType(field("API_KEY"), "password")).toBe("CONCEALED");
    });

    test("reveals every field for the text type", () => {
        expect(determineFieldType(field("DEBUG"), "text")).toBe("STRING");
        expect(determineFieldType(field("API_KEY"), "text")).toBe("STRING");
    });

    test("still accepts the boolean form library callers used before SecretType", () => {
        expect(determineFieldType(field("DEBUG"), true)).toBe("CONCEALED");
        expect(determineFieldType(field("API_KEY"), false)).toBe("STRING");
    });

    describe("auto", () => {
        test.each([
            "API_KEY",
            "DATABASE_PASSWORD",
            "STRIPE_SECRET_KEY",
            "AUTH_TOKEN",
            "TLS_CERT",
            "ENCRYPTION_IV",
            "DB_PASS",
            "MYSQL_PWD",
            "SENTRY_DSN",
            "JWT_SIGNING_KEY",
            "SSH_PRIVATE_KEY",
            "GITHUB_PAT",
            "PASSWORD_SALT",
            "ACCESSTOKEN",
            "CLIENTSECRET",
            "apiKey",
        ])("conceals %s", (key) => {
            expect(determineFieldType(field(key), "auto")).toBe("CONCEALED");
        });

        test.each([
            "NODE_ENV",
            "DEBUG",
            "DATABASE_URL",
            "PORT",
            "LOG_LEVEL",
            "MONKEY_MODE",
            "KEYBOARD_LAYOUT",
            "CERTAIN_FLAG",
            "PASSENGER_COUNT",
        ])("reveals %s", (key) => {
            expect(determineFieldType(field(key), "auto")).toBe("STRING");
        });

        test("matches regardless of case", () => {
            expect(determineFieldType(field("api_key"), "auto")).toBe("CONCEALED");
        });

        test("conceals a URL that carries a password, whatever the name", () => {
            expect(determineFieldType(field("DATABASE_URL", "postgres://app:s3cret@db:5432/app"), "auto")).toBe(
                "CONCEALED",
            );
            expect(determineFieldType(field("REDIS_URL", "redis://:s3cret@cache:6379"), "auto")).toBe("CONCEALED");
        });

        test("reveals a URL without a password", () => {
            expect(determineFieldType(field("DATABASE_URL", "postgres://localhost:5432/app"), "auto")).toBe("STRING");
            expect(determineFieldType(field("API_URL", "https://user@example.com/v1"), "auto")).toBe("STRING");
        });
    });
});

describe("parseSecretType", () => {
    test.each(SECRET_TYPES)("accepts %s", (value) => {
        expect(parseSecretType(value)).toBe(value);
    });

    test("rejects unknown values", () => {
        expect(parseSecretType("bogus")).toBeNull();
        expect(parseSecretType("")).toBeNull();
        expect(parseSecretType("TEXT")).toBeNull();
    });
});
