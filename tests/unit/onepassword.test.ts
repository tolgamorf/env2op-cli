import { describe, expect, test } from "bun:test";
import { determineFieldType } from "../../src/core/onepassword";
import { parseSecretType, SecretType } from "../../src/core/types";

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
