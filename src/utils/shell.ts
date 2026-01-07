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
 * Execute a shell command and return the result
 */
export async function exec(command: string, args: string[] = [], options: ExecOptions = {}): Promise<ExecResult> {
    const { verbose = false } = options;
    const fullCommand = `${command} ${args.map(quoteArg).join(" ")}`;

    if (verbose) {
        console.log(pc.dim(`$ ${fullCommand}`));
    }

    return new Promise((resolve) => {
        const proc = spawn(command, args, {
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data: Buffer) => {
            const text = data.toString();
            stdout += text;
            if (verbose) {
                process.stdout.write(text);
            }
        });

        proc.stderr?.on("data", (data: Buffer) => {
            const text = data.toString();
            stderr += text;
            if (verbose) {
                process.stderr.write(text);
            }
        });

        proc.on("close", (code) => {
            resolve({
                stdout,
                stderr,
                exitCode: code ?? 0,
            });
        });

        proc.on("error", () => {
            resolve({
                stdout,
                stderr,
                exitCode: 1,
            });
        });
    });
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

    return new Promise((resolve) => {
        const proc = spawn(command, args, {
            stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        proc.stdin?.write(stdinContent);
        proc.stdin?.end();

        proc.stdout?.on("data", (data: Buffer) => {
            const text = data.toString();
            stdout += text;
            if (verbose) process.stdout.write(text);
        });

        proc.stderr?.on("data", (data: Buffer) => {
            const text = data.toString();
            stderr += text;
            if (verbose) process.stderr.write(text);
        });

        proc.on("close", (code) => {
            resolve({ stdout, stderr, exitCode: code ?? 0 });
        });

        proc.on("error", () => {
            resolve({ stdout, stderr, exitCode: 1 });
        });
    });
}

/**
 * Execute a command and parse stdout as JSON
 */
export async function execJson<T>(command: string, args: string[] = [], options: ExecOptions = {}): Promise<T> {
    const result = await execOrThrow(command, args, options);
    return JSON.parse(result.stdout) as T;
}
