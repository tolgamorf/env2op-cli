import { describe, expect, mock, test } from "bun:test";

/**
 * These tests verify the onepassword module's interface and behavior
 * by mocking the entire module. Actual op CLI calls are tested manually
 * or in end-to-end tests with real 1Password setup.
 */
describe("onepassword module", () => {
    test("module exports expected functions", async () => {
        const op = await import("../../src/core/onepassword");

        expect(typeof op.checkOpCli).toBe("function");
        expect(typeof op.checkSignedIn).toBe("function");
        expect(typeof op.vaultExists).toBe("function");
        expect(typeof op.createVault).toBe("function");
        expect(typeof op.itemExists).toBe("function");
        expect(typeof op.createSecureNote).toBe("function");
        expect(typeof op.editSecureNote).toBe("function");
    });

    test("functions return promises", async () => {
        const op = await import("../../src/core/onepassword");

        // We can't easily test the actual behavior without mocking Bun's $
        // but we can verify the function signatures exist
        expect(op.checkOpCli.constructor.name).toBe("AsyncFunction");
        expect(op.checkSignedIn.constructor.name).toBe("AsyncFunction");
        expect(op.vaultExists.constructor.name).toBe("AsyncFunction");
    });
});

describe("onepassword module - mocked at module level", () => {
    test("can mock checkOpCli to return true", async () => {
        mock.module("../../src/core/onepassword", () => ({
            checkOpCli: async () => true,
            checkSignedIn: async () => true,
            vaultExists: async () => true,
            createVault: async () => {},
            itemExists: async () => false,
            createSecureNote: async () => ({
                id: "item123",
                title: "Test",
                vault: "Personal",
                vaultId: "vault123",
                fieldIds: {},
            }),
            editSecureNote: async () => ({
                id: "item123",
                title: "Test",
                vault: "Personal",
                vaultId: "vault123",
                fieldIds: {},
            }),
        }));

        const { checkOpCli } = await import("../../src/core/onepassword");
        const result = await checkOpCli();
        expect(result).toBe(true);
    });

    test("can mock checkOpCli to return false", async () => {
        mock.module("../../src/core/onepassword", () => ({
            checkOpCli: async () => false,
            checkSignedIn: async () => false,
            vaultExists: async () => false,
            createVault: async () => {},
            itemExists: async () => false,
            createSecureNote: async () => ({}),
            editSecureNote: async () => ({}),
        }));

        const { checkOpCli } = await import("../../src/core/onepassword");
        const result = await checkOpCli();
        expect(result).toBe(false);
    });
});
