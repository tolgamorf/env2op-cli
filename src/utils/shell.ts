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
    verbose?: boolean;
}

function quoteArg(arg: string): string {
    if (/[ \[\]'"\\=]/.test(arg)) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
    }
    return arg;
}

/**
 * Execute a shell command and return the result
 */
export async function exec(command: string, args: string[] = [], options: ExecOptions = {}): Promise<ExecResult> {
    const { verbose = false } = options;
    const fullCommand = `${command} ${args.map(quoteArg).join(" ")}`;

    if (verbose) {
        console.log(pc.dim(`$ ${fullCommand}`));
    }

    // Check if command has field arguments (like KEY[type]=value)
    const hasFieldArgs = args.some((arg) => /\[.+\]=/.test(arg));

    if (hasFieldArgs) {
        // Commands with field args MUST use stdio inherit - op CLI hangs otherwise
        const result = spawnSync("bash", ["-c", fullCommand], {
            stdio: "inherit",
        });

        return {
            stdout: "",
            stderr: "",
            exitCode: result.status ?? 0,
        };
    }

    // For other commands, capture stdout via temp file
    const tempFile = join(tmpdir(), `env2op-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
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

/**
 * Execute a command and throw if it fails
 */
export async function execOrThrow(
    command: string,
    args: string[] = [],
    options: ExecOptions = {},
): Promise<ExecResult> {
    const result = await exec(command, args, options);
    if (result.exitCode !== 0) {
        const error = new Error(result.stderr || `Command failed with exit code ${result.exitCode}`);
        (error as ExecError).stderr = result.stderr;
        (error as ExecError).stdout = result.stdout;
        (error as ExecError).exitCode = result.exitCode;
        throw error;
    }
    return result;
}

interface ExecError extends Error {
    stderr: string;
    stdout: string;
    exitCode: number;
}

/**
 * Execute a command and parse stdout as JSON
 */
export async function execJson<T>(command: string, args: string[] = [], options: ExecOptions = {}): Promise<T> {
    const result = await execOrThrow(command, args, options);
    return JSON.parse(result.stdout) as T;
}
