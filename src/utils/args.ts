/**
 * CLI argument parsing utility
 */

export interface ParsedArgs {
    flags: Set<string>;
    positional: string[];
    options: Record<string, string>;
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
 * Parse CLI arguments into flags, positional args, and options
 *
 * Handles:
 * - Long flags: --flag (added to flags as "flag")
 * - Short flags: -f (added to flags as "f")
 * - Combined short flags: -abc (added as "a", "b", "c")
 * - Options with values: -o value, --output value, --output=value
 * - Value options used without a value: recorded as a flag instead (e.g. bare --secret)
 * - Positional arguments: anything not starting with -
 */
export function parseArgs(args: string[]): ParsedArgs {
    const flags = new Set<string>();
    const positional: string[] = [];
    const options: Record<string, string> = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i] as string;

        // Split the `--option=value` form into its name and inline value
        const equals = arg.startsWith("--") ? arg.indexOf("=") : -1;
        const name = equals === -1 ? arg : arg.slice(0, equals);
        const inlineValue = equals === -1 ? undefined : arg.slice(equals + 1);

        const optionKey = VALUE_OPTIONS[name];
        if (optionKey) {
            const next = args[i + 1];
            if (inlineValue !== undefined) {
                options[optionKey] = inlineValue;
            } else if (next && !next.startsWith("-")) {
                options[optionKey] = next;
                i++; // skip next arg
            } else {
                // Used without a value — keep it addressable as a flag
                flags.add(name.replace(/^--?/, ""));
            }
        } else if (arg.startsWith("--")) {
            flags.add(arg.slice(2));
        } else if (arg.startsWith("-")) {
            // Handle short flags
            for (const char of arg.slice(1)) {
                flags.add(char);
            }
        } else {
            positional.push(arg);
        }
    }

    return { flags, positional, options };
}
