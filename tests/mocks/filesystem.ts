import { mock } from "bun:test";

/**
 * Mock the node:fs module with virtual files
 */
export function mockFs(files: Record<string, string>) {
    mock.module("node:fs", () => ({
        readFileSync: (path: string) => {
            if (path in files) {
                return files[path];
            }
            const error = new Error(`ENOENT: no such file or directory, open '${path}'`);
            (error as NodeJS.ErrnoException).code = "ENOENT";
            throw error;
        },
        writeFileSync: (_path: string, _content: string) => {
            // No-op for tests, or could track writes
        },
        existsSync: (path: string) => {
            return path in files;
        },
    }));
}

/**
 * Create a mock fs that tracks writes
 */
export function mockFsWithWriteTracking(files: Record<string, string>) {
    const writes: Record<string, string> = {};

    mock.module("node:fs", () => ({
        readFileSync: (path: string) => {
            // Check writes first, then initial files
            if (path in writes) {
                return writes[path];
            }
            if (path in files) {
                return files[path];
            }
            const error = new Error(`ENOENT: no such file or directory, open '${path}'`);
            (error as NodeJS.ErrnoException).code = "ENOENT";
            throw error;
        },
        writeFileSync: (path: string, content: string) => {
            writes[path] = content;
        },
        existsSync: (path: string) => {
            return path in writes || path in files;
        },
    }));

    return {
        getWrites: () => writes,
        getWrite: (path: string) => writes[path],
    };
}
