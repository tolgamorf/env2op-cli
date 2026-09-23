/**
 * CLI argument parsing utility
 */

export interface ParsedArgs {
    flags: Set<string>;
    positional: string[];
    options: Record<string, string>;
    /** Problems with the arguments (unknown flags, missing option values) */
    errors: string[];
}

/**
 * Arguments that take a value, mapped to the key they are stored under in `options`
 */
const VALUE_OPTIONS: Record<string, string> = {
    "-o": "output",
    "--output": "output",
    "--secret": "secret",
};

/**
 * Value options that may also be used bare, as a flag (bare `--secret` means `--secret=password`).
 * These take a value only in the `--option=value` form: bare `--secret` came first, so a
 * space-separated value would swallow whatever follows it, e.g. the `.env` path in
 * `env2op --secret .env Vault Item`.
 */
const FLAG_WHEN_BARE = new Set(["--secret"]);

/**
 * Parse CLI arguments into flags, positional args, and options
 *
 * Handles:
 * - Long flags: --flag (added to flags as "flag")
 * - Short flags: -f (added to flags as "f")
 * - Combined short flags: -abc (added as "a", "b", "c")
 * - Options with values: -o value, --output value, --output=value
 * - Bare-flag options: --secret (a flag) or --secret=value, never --secret value
 * - Positional arguments: anything not starting with -
 *
 * A flag not in `knownFlags` is reported in `errors` rather than ignored, so a typo
 * like `--dryrun` stops the command instead of running it for real.
 */
export function parseArgs(args: string[], knownFlags: readonly string[]): ParsedArgs {
    const known = new Set(knownFlags);
    const flags = new Set<string>();
    const positional: string[] = [];
    const options: Record<string, string> = {};
    const errors: string[] = [];

    const addFlag = (name: string, display: string) => {
        if (known.has(name)) {
            flags.add(name);
        } else {
            errors.push(`Unknown option: ${display}`);
        }
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i] as string;

        // Split the `--option=value` form into its name and inline value
        const equals = arg.startsWith("--") ? arg.indexOf("=") : -1;
        const name = equals === -1 ? arg : arg.slice(0, equals);
        const inlineValue = equals === -1 ? undefined : arg.slice(equals + 1);

        const optionKey = VALUE_OPTIONS[name];
        if (optionKey) {
            const next = args[i + 1];
            if (inlineValue) {
                options[optionKey] = inlineValue;
            } else if (inlineValue === undefined && !FLAG_WHEN_BARE.has(name) && next && !next.startsWith("-")) {
                options[optionKey] = next;
                i++; // skip next arg
            } else if (inlineValue === undefined && FLAG_WHEN_BARE.has(name)) {
                // Used without a value — keep it addressable as a flag
                addFlag(name.replace(/^--?/, ""), name);
            } else {
                errors.push(`${name} requires ${optionKey === "output" ? "a path" : "a value"}`);
            }
        } else if (arg.startsWith("--")) {
            addFlag(arg.slice(2), arg);
        } else if (arg.startsWith("-") && arg.length > 1) {
            // Handle short flags
            for (const char of arg.slice(1)) {
                addFlag(char, `-${char}`);
            }
        } else {
            positional.push(arg);
        }
    }

    return { flags, positional, options, errors };
}
