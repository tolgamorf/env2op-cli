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
 * Parse CLI arguments into flags, positional args, and options
 *
 * Handles:
 * - Long flags: --flag (added to flags as "flag")
 * - Short flags: -f (added to flags as "f")
 * - Combined short flags: -abc (added as "a", "b", "c")
 * - Options with values: -o value, --output value, --output=value
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
        if (arg === "-o" || arg === "--output") {
            const next = args[i + 1];
            if (next && !next.startsWith("-")) {
                options.output = next;
                i++; // skip next arg
            } else {
                errors.push(`${arg} requires a path`);
            }
        } else if (arg.startsWith("--output=")) {
            const value = arg.slice("--output=".length);
            if (value) {
                options.output = value;
            } else {
                errors.push("--output requires a path");
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
