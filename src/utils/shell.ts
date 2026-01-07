import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pc from "picocolors";

interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

interface ExecOptions {
    /** Stream output to console in real-time */
    verbose?: boolean;
}

/**
 * Quote arg for shell if needed
 */
function quoteArg(arg: string): string {
    // Don't quote flags like --format=json
    if (arg.startsWith("-")) {
        return arg;
    }
    // Quote if contains special chars (spaces, brackets, quotes)
    if (/[ \[\]'"\\]/.test(arg)) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
    }
    return arg;
}

/**
 * Format command and args for display/execution
 */
function formatCommand(command: string, args: string[]): string {
    return `${command} ${args.map(quoteArg).join(" ")}`;
}

/**
 * Execute a shell command and return the result
 */
export async function exec(command: string, args: string[] = [], options: ExecOptions = {}): Promise<ExecResult> {
    const { verbose = false } = options;

    const fullCommand = formatCommand(command, args);

    // Log command in verbose mode
    if (verbose) {
        console.log(pc.dim(`$ ${fullCommand}`));
    }

    // Use temp file to capture stdout (piping causes hanging)
    const tempFile = join(tmpdir(), `env2op-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

    // Check if command has field arguments (like KEY[type]=value) - these hang with redirects
    const hasFieldArgs = args.some((arg) => /\[.+\]=/.test(arg));

    if (hasFieldArgs) {
        // Commands with field args (create/edit) - must use stdio inherit to avoid hanging
        const result = spawnSync("bash", ["-c", fullCommand], {
            stdio: "inherit",
        });

        return {
            stdout: "",
            stderr: "",
            exitCode: result.status ?? 0,
        };
    } else {
        // Simple commands - redirect stdout to temp file
        const cmdWithRedirect = `${fullCommand} > '${tempFile}'`;

        const result = spawnSync("bash", ["-c", cmdWithRedirect], {
            stdio: "inherit",
        });

        let stdout = "";
        try {
            stdout = readFileSync(tempFile, "utf-8");
        } catch {
            // File might not exist if command failed early
        }

        if (verbose && stdout) {
            console.log(stdout);
        }

        try {
            unlinkSync(tempFile);
        } catch {
            // Ignore cleanup errors
        }

        return {
            stdout,
            stderr: "",
            exitCode: result.status ?? 0,
        };
    }
}

/**
 * Execute a command and throw if it fails (non-zero exit code)
 * Shows stderr in error message for debugging even in non-verbose mode
 */
export async function execOrThrow(
    command: string,
    args: string[] = [],
    options: ExecOptions = {},
): Promise<ExecResult> {
    const result = await exec(command, args, options);
    if (result.exitCode !== 0) {
        // Include stderr in error message so it's visible even in non-verbose mode
        const errorMessage = result.stderr?.trim() || `Command failed with exit code ${result.exitCode}`;
        const error = new Error(errorMessage);
        (error as ExecError).stderr = result.stderr;
        (error as ExecError).stdout = result.stdout;
        (error as ExecError).exitCode = result.exitCode;
        (error as ExecError).command = formatCommand(command, args);
        throw error;
    }
    return result;
}

interface ExecError extends Error {
    stderr: string;
    stdout: string;
    exitCode: number;
    command: string;
}

/**
 * Execute a command and parse stdout as JSON
 */
export async function execJson<T>(command: string, args: string[] = [], options: ExecOptions = {}): Promise<T> {
    const result = await execOrThrow(command, args, options);
    return JSON.parse(result.stdout) as T;
}