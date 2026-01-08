import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
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
    if (/[ [\]'"\\=]/.test(arg)) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
    }
    return arg;
}

/**
 * Collect stdout/stderr from a child process and resolve when complete
 */
function collectOutput(proc: ChildProcess, verbose: boolean): Promise<ExecResult> {
    return new Promise((resolve) => {
        const stdoutChunks: string[] = [];
        const stderrChunks: string[] = [];

        proc.stdout?.on("data", (data: Buffer | string) => {
            const text = Buffer.isBuffer(data) ? data.toString() : String(data);
            stdoutChunks.push(text);
            if (verbose) {
                process.stdout.write(text);
            }
        });

        proc.stderr?.on("data", (data: Buffer | string) => {
            const text = Buffer.isBuffer(data) ? data.toString() : String(data);
            stderrChunks.push(text);
            if (verbose) {
                process.stderr.write(text);
            }
        });

        proc.on("close", (code) => {
            resolve({
                stdout: stdoutChunks.join(""),
                stderr: stderrChunks.join(""),
                exitCode: code ?? 1,
            });
        });

        proc.on("error", (err) => {
            stderrChunks.push(err.message);
            resolve({
                stdout: stdoutChunks.join(""),
                stderr: stderrChunks.join(""),
                exitCode: 1,
            });
        });
    });
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

    const proc = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
    });

    return collectOutput(proc, verbose);
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

interface ExecWithStdinOptions extends ExecOptions {
    stdin: string;
}

/**
 * Execute a shell command with content piped to stdin
 */
export async function execWithStdin(
    command: string,
    args: string[] = [],
    options: ExecWithStdinOptions,
): Promise<ExecResult> {
    const { stdin: stdinContent, verbose = false } = options;

    if (verbose) {
        const fullCommand = `${command} ${args.map(quoteArg).join(" ")}`;
        console.log(pc.dim(`$ echo '...' | ${fullCommand}`));
    }

    const proc = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdin?.write(stdinContent);
    proc.stdin?.end();

    return collectOutput(proc, verbose);
}
