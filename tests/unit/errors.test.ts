import { describe, expect, test } from "bun:test";
import { Env2OpError, ErrorCodes, errors } from "../../src/utils/errors";

describe("Env2OpError", () => {
    test("is an instance of Error", () => {
        const error = new Env2OpError("test message", ErrorCodes.INJECT_FAILED);
        expect(error).toBeInstanceOf(Error);
    });

    test("has correct name", () => {
        const error = new Env2OpError("test message", ErrorCodes.INJECT_FAILED);
        expect(error.name).toBe("Env2OpError");
    });

    test("stores error code", () => {
        const error = new Env2OpError("test message", ErrorCodes.VAULT_NOT_FOUND);
        expect(error.code).toBe("VAULT_NOT_FOUND");
    });

    test("stores suggestion when provided", () => {
        const error = new Env2OpError("test", ErrorCodes.INJECT_FAILED, "try this");
        expect(error.suggestion).toBe("try this");
    });

    test("suggestion is undefined when not provided", () => {
        const error = new Env2OpError("test", ErrorCodes.INJECT_FAILED);
        expect(error.suggestion).toBeUndefined();
    });
});

describe("error factory functions", () => {
    test("envFileNotFound creates correct error", () => {
        const error = errors.envFileNotFound("/path/to/.env");
        expect(error.code).toBe("ENV_FILE_NOT_FOUND");
        expect(error.message).toContain("/path/to/.env");
        expect(error.suggestion).toBeDefined();
    });

    test("envFileEmpty creates correct error", () => {
        const error = errors.envFileEmpty(".env");
        expect(error.code).toBe("ENV_FILE_EMPTY");
        expect(error.message).toContain(".env");
    });

    test("opCliNotInstalled creates correct error", () => {
        const error = errors.opCliNotInstalled();
        expect(error.code).toBe("OP_CLI_NOT_INSTALLED");
        expect(error.suggestion).toContain("1password.com");
    });

    test("opNotSignedIn creates correct error", () => {
        const error = errors.opNotSignedIn();
        expect(error.code).toBe("OP_NOT_SIGNED_IN");
        expect(error.suggestion).toContain("op signin");
    });

    test("vaultNotFound creates correct error", () => {
        const error = errors.vaultNotFound("Personal");
        expect(error.code).toBe("VAULT_NOT_FOUND");
        expect(error.message).toContain("Personal");
    });

    test("vaultCreateFailed creates correct error", () => {
        const error = errors.vaultCreateFailed("permission denied");
        expect(error.code).toBe("VAULT_CREATE_FAILED");
        expect(error.message).toContain("permission denied");
    });

    test("itemCreateFailed creates correct error", () => {
        const error = errors.itemCreateFailed("network error");
        expect(error.code).toBe("ITEM_CREATE_FAILED");
        expect(error.message).toContain("network error");
    });

    test("opCommandFailed creates correct error", () => {
        const error = errors.opCommandFailed("list vaults", "session expired");
        expect(error.code).toBe("OP_COMMAND_FAILED");
        expect(error.message).toContain("list vaults");
        expect(error.message).toContain("session expired");
    });
});

describe("ErrorCodes", () => {
    test("contains all expected error codes", () => {
        expect(ErrorCodes.ENV_FILE_NOT_FOUND).toBe("ENV_FILE_NOT_FOUND");
        expect(ErrorCodes.ENV_FILE_EMPTY).toBe("ENV_FILE_EMPTY");
        expect(ErrorCodes.OP_CLI_NOT_INSTALLED).toBe("OP_CLI_NOT_INSTALLED");
        expect(ErrorCodes.OP_NOT_SIGNED_IN).toBe("OP_NOT_SIGNED_IN");
        expect(ErrorCodes.VAULT_NOT_FOUND).toBe("VAULT_NOT_FOUND");
        expect(ErrorCodes.VAULT_CREATE_FAILED).toBe("VAULT_CREATE_FAILED");
        expect(ErrorCodes.ITEM_CREATE_FAILED).toBe("ITEM_CREATE_FAILED");
        expect(ErrorCodes.OP_COMMAND_FAILED).toBe("OP_COMMAND_FAILED");
        expect(ErrorCodes.TEMPLATE_NOT_FOUND).toBe("TEMPLATE_NOT_FOUND");
        expect(ErrorCodes.INJECT_FAILED).toBe("INJECT_FAILED");
    });
});
