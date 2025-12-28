import { mock } from "bun:test";

export interface PromptResponses {
    confirm?: boolean | "cancel";
    text?: string | "cancel";
    select?: string | "cancel";
}

/**
 * Mock @clack/prompts module
 */
export function mockPrompts(responses: PromptResponses = {}) {
    const cancelSymbol = Symbol("cancel");

    mock.module("@clack/prompts", () => ({
        intro: () => {},
        outro: () => {},
        log: {
            success: () => {},
            error: () => {},
            warn: () => {},
            info: () => {},
            step: () => {},
            message: () => {},
        },
        note: () => {},
        cancel: () => {},
        spinner: () => ({
            start: () => {},
            stop: () => {},
        }),
        confirm: async () => {
            if (responses.confirm === "cancel") {
                return cancelSymbol;
            }
            return responses.confirm ?? true;
        },
        text: async () => {
            if (responses.text === "cancel") {
                return cancelSymbol;
            }
            return responses.text ?? "";
        },
        select: async () => {
            if (responses.select === "cancel") {
                return cancelSymbol;
            }
            return responses.select ?? "";
        },
        isCancel: (value: unknown) => value === cancelSymbol,
    }));

    return { cancelSymbol };
}
