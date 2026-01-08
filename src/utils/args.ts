/**
 * CLI argument parsing utility
 */

export interface ParsedArgs {
    flags: Set<string>;
    positional: string[];
    options: Record<string, string>;
}

/**
 * Parse CLI arguments into flags, positional args, and options
 *
 * Handles:
 * - Long flags: --flag (added to flags as "flag")
 * - Short flags: -f (added to flags as "f")
 * - Combined short flags: -abc (added as "a", "b", "c")
 * - Options with values: -o value, --output value
 * - Positional arguments: anything not starting with -
 */
export function parseArgs(args: string[]): ParsedArgs {
    const flags = new Set<string>();
    const positional: string[] = [];
    const options: Record<string, string> = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i] as string;
        if (arg === "-o" || arg === "--output") {
            const next = args[i + 1];
            if (next && !next.startsWith("-")) {
                options.output = next;
                i++; // skip next arg
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
