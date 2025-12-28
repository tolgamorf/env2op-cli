import { mock } from "bun:test";

export interface OpCliMockOptions {
    installed?: boolean;
    signedIn?: boolean;
    vaults?: Record<string, { id: string; name: string }>;
    items?: Record<
        string,
        {
            id: string;
            title: string;
            vault: { id: string; name: string };
            fields: Array<{ id: string; label: string; value: string }>;
        }
    >;
    createItemResponse?: {
        id: string;
        title: string;
        vault: { id: string; name: string };
        fields: Array<{ id: string; label: string }>;
    };
    injectSuccess?: boolean;
    errors?: {
        vaultCreate?: string;
        itemCreate?: string;
        inject?: string;
    };
}

/**
 * Create a mock shell result object
 */
function createShellResult(stdout: string, exitCode = 0) {
    return {
        stdout: Buffer.from(stdout),
        stderr: Buffer.from(""),
        exitCode,
        text: () => stdout,
        json: () => JSON.parse(stdout),
        quiet: () => createShellResult(stdout, exitCode),
    };
}

/**
 * Create a failing shell result
 */
function createShellError(message: string) {
    const error = new Error(message);
    return error;
}

/**
 * Mock the bun module's $ shell execution
 */
export function mockOpCli(options: OpCliMockOptions = {}) {
    const {
        installed = true,
        signedIn = true,
        vaults = {},
        items = {},
        createItemResponse,
        injectSuccess = true,
        errors = {},
    } = options;

    // Track calls for assertions
    const calls: Array<{ command: string; args: string[] }> = [];

    mock.module("bun", () => {
        // Create a tagged template function that mimics Bun's $
        const shellFn = (strings: TemplateStringsArray, ...values: unknown[]) => {
            // Reconstruct the command from template literal parts
            let command = "";
            for (let i = 0; i < strings.length; i++) {
                command += strings[i];
                if (i < values.length) {
                    const value = values[i];
                    if (Array.isArray(value)) {
                        command += value.join(" ");
                    } else {
                        command += String(value);
                    }
                }
            }

            command = command.trim();
            calls.push({ command, args: command.split(" ") });

            // Create a thenable result object
            const createResult = () => {
                // op --version
                if (command.includes("op --version")) {
                    if (!installed) {
                        throw createShellError("op: command not found");
                    }
                    return createShellResult("2.24.0");
                }

                // op account get
                if (command.includes("op account get")) {
                    if (!signedIn) {
                        throw createShellError("not signed in");
                    }
                    return createShellResult('{"id": "account123"}');
                }

                // op vault get <vault>
                if (command.includes("op vault get")) {
                    const vaultMatch = command.match(/op vault get (\S+)/);
                    const vaultName = vaultMatch?.[1];
                    if (vaultName && vaults[vaultName]) {
                        return createShellResult(JSON.stringify(vaults[vaultName]));
                    }
                    throw createShellError(`vault "${vaultName}" not found`);
                }

                // op vault create <name>
                if (command.includes("op vault create")) {
                    if (errors.vaultCreate) {
                        throw createShellError(errors.vaultCreate);
                    }
                    return createShellResult("");
                }

                // op item get <title> --vault <vault>
                if (command.includes("op item get")) {
                    const itemMatch = command.match(/op item get (\S+)/);
                    const itemName = itemMatch?.[1];
                    if (itemName && items[itemName]) {
                        return createShellResult(JSON.stringify(items[itemName]));
                    }
                    throw createShellError(`item "${itemName}" not found`);
                }

                // op item delete
                if (command.includes("op item delete")) {
                    return createShellResult("");
                }

                // op item create
                if (command.includes("op item create")) {
                    if (errors.itemCreate) {
                        throw createShellError(errors.itemCreate);
                    }
                    if (createItemResponse) {
                        return createShellResult(JSON.stringify(createItemResponse));
                    }
                    // Default response
                    return createShellResult(
                        JSON.stringify({
                            id: "item123",
                            title: "Test Item",
                            vault: { id: "vault123", name: "Personal" },
                            fields: [
                                { id: "field1", label: "KEY1" },
                                { id: "field2", label: "KEY2" },
                            ],
                        }),
                    );
                }

                // op inject
                if (command.includes("op inject")) {
                    if (!injectSuccess || errors.inject) {
                        throw createShellError(errors.inject ?? "inject failed");
                    }
                    return createShellResult("");
                }

                // Unknown command
                throw createShellError(`Unknown op command: ${command}`);
            };

            // Return a promise-like object with .quiet() and .json()
            const shellResult = createResult();
            const promise = Promise.resolve(shellResult);

            // Add shell-specific methods to the promise
            const enhancedPromise = Object.assign(promise, {
                quiet: () => enhancedPromise,
                json: async () => shellResult.json(),
                text: async () => shellResult.text(),
            });

            return enhancedPromise;
        };

        return {
            $: shellFn,
        };
    });

    return {
        getCalls: () => calls,
        getCallCount: () => calls.length,
        wasCalledWith: (substring: string) => calls.some((c) => c.command.includes(substring)),
    };
}
