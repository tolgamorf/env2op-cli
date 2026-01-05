import { spawn } from "node:child_process";

interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * Execute a shell command and return the result
 */
export async function exec(command: string, args: string[] = []): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            shell: false,
            stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data: Buffer) => {
            stdout += data.toString();
        });

        proc.stderr?.on("data", (data: Buffer) => {
            stderr += data.toString();
        });

        proc.on("error", (error) => {
            reject(error);
        });

        proc.on("close", (code) => {
            resolve({
                stdout,
                stderr,
                exitCode: code ?? 0,
            });
        });
    });
}

/**
 * Execute a command and throw if it fails (non-zero exit code)
 */
export async function execOrThrow(command: string, args: string[] = []): Promise<ExecResult> {
    const result = await exec(command, args);
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
export async function execJson<T>(command: string, args: string[] = []): Promise<T> {
    const result = await execOrThrow(command, args);
    return JSON.parse(result.stdout) as T;
}

/**
 * Execute a command silently (ignore output), return true if successful
 */
export async function execQuiet(command: string, args: string[] = []): Promise<boolean> {
    try {
        const result = await exec(command, args);
        return result.exitCode === 0;
    } catch {
        return false;
    }
}
