import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import pc from "picocolors";
import { isInterrupted } from "./interrupt";

interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    /** Set when the process could not be started, e.g. "ENOENT" when the command is not installed */
    spawnError?: string;
}

interface ExecOptions {
    verbose?: boolean;
    /** Keep stdout off the terminal in verbose mode, for output that carries secret values */
    hideStdout?: boolean;
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
function collectOutput(proc: ChildProcess, verbose: boolean, hideStdout = false): Promise<ExecResult> {
    return new Promise((resolve) => {
        const stdoutChunks: string[] = [];
        const stderrChunks: string[] = [];

        proc.stdout?.on("data", (data: Buffer | string) => {
            const text = Buffer.isBuffer(data) ? data.toString() : String(data);
            stdoutChunks.push(text);
            if (verbose && !hideStdout) {
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
            if (verbose && hideStdout && stdoutChunks.length > 0) {
                console.log(pc.dim("(output hidden: it contains secret values)"));
            }
            resolve({
                stdout: stdoutChunks.join(""),
                stderr: stderrChunks.join(""),
                exitCode: code ?? 1,
            });
        });

        proc.on("error", (err: NodeJS.ErrnoException) => {
            stderrChunks.push(err.message);
            resolve({
                stdout: stdoutChunks.join(""),
                stderr: stderrChunks.join(""),
                exitCode: 1,
                spawnError: err.code ?? "UNKNOWN",
            });
        });
    });
}

/** What a command "returns" when it is not started because the process is being interrupted */
function interruptedResult(): ExecResult {
    return { stdout: "", stderr: "interrupted", exitCode: 1 };
}

/**
 * Execute a shell command and return the result
 */
export async function exec(command: string, args: string[] = [], options: ExecOptions = {}): Promise<ExecResult> {
    if (isInterrupted()) {
        return interruptedResult();
    }
    const { verbose = false, hideStdout = false } = options;
    const fullCommand = `${command} ${args.map(quoteArg).join(" ")}`;

    if (verbose) {
        console.log(pc.dim(`$ ${fullCommand}`));
    }

    const proc = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
    });

    return collectOutput(proc, verbose, hideStdout);
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
    if (isInterrupted()) {
        return interruptedResult();
    }
    const { stdin: stdinContent, verbose = false, hideStdout = false } = options;

    if (verbose) {
        const fullCommand = `${command} ${args.map(quoteArg).join(" ")}`;
        console.log(pc.dim(`$ echo '...' | ${fullCommand}`));
    }

    const proc = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdin?.write(stdinContent);
    proc.stdin?.end();

    return collectOutput(proc, verbose, hideStdout);
}
