import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Exit codes when a confirmation prompt is declined: the real env2op/op2env bins run as
 * child processes against a fake `op`, so a caller can rely on 2 meaning "nothing written".
 */
const ROOT = join(import.meta.dir, "../..");
const ENV2OP = join(ROOT, "src/cli.ts");
const OP2ENV = join(ROOT, "src/op2env-cli.ts");
const hasScript = process.platform === "linux" && Bun.which("script") !== null;

let dir: string;

/** A fake `op` whose vault and item listings are given per test; any write fails loudly. */
function fakeOp(vaults: string, items: string): void {
    const bin = join(dir, "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(
        join(bin, "op"),
        `#!/bin/sh
case "$1" in
  whoami) echo '{}' ;;
  vault) [ "$2" = list ] && echo '${vaults}' || { echo "vault $2 called" >&2; exit 1; } ;;
  item) [ "$2" = list ] && echo '${items}' || { echo "item $2 called" >&2; exit 1; } ;;
  inject) echo "inject called" >&2; exit 1 ;;
esac
`,
    );
    chmodSync(join(bin, "op"), 0o755);
}

/**
 * Run a bin. With `keys`, it runs under a pseudo-terminal (via `script`) and the keys are
 * typed into the prompt; without, stdin is closed and there is no terminal.
 */
async function run(bin: string, args: string[], keys?: string): Promise<{ code: number; output: string }> {
    const env = {
        ...process.env,
        PATH: `${join(dir, "bin")}:${process.env.PATH}`,
        ENV2OP_NO_UPDATE_CHECK: "1",
        NO_COLOR: "1",
    };
    if (keys === undefined) {
        const proc = Bun.spawn(["bun", "run", bin, ...args], {
            cwd: dir,
            env,
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
        });
        const [code, stdout, stderr] = await Promise.all([
            proc.exited,
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
        ]);
        return { code, output: stdout + stderr };
    }

    // `script` gives the bin a pseudo-terminal and forwards our stdin to it. Its stdin stays
    // open until the bin exits: closing it early would end the prompt with EOF, not a key.
    // `stty` gives that terminal a size; without one, clack wraps after every character.
    const command = `stty cols 120 rows 40; ${["bun", "run", bin, ...args].map((a) => `'${a}'`).join(" ")}`;
    const proc = Bun.spawn(["script", "-qefc", command, "/dev/null"], {
        cwd: dir,
        env,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
    });

    // Type only once the prompt is on screen. clack puts the terminal in raw mode before it
    // draws the prompt, so the keys then reach it; sent any earlier, Ctrl-C would be a real
    // SIGINT (exit 130) and a letter would sit in the line buffer instead.
    let output = "";
    let typed = false;
    const decoder = new TextDecoder();
    for await (const chunk of proc.stdout) {
        output += decoder.decode(chunk, { stream: true });
        if (!typed && output.includes("Yes / ")) {
            proc.stdin.write(keys);
            proc.stdin.flush();
            typed = true;
        }
    }
    const code = await proc.exited;
    proc.stdin.end();
    return { code, output: output + (await new Response(proc.stderr).text()) };
}

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "env2op-decline-"));
    writeFileSync(join(dir, ".env"), "API_KEY=abc\n");
    writeFileSync(join(dir, ".env.tpl"), "API_KEY=op://V/i1/f1\n");
});

afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(process.platform === "win32")("declining a confirmation exits 2 and writes nothing", () => {
    const EXISTING_ITEM = '[{"id":"i1","title":"Item"}]';
    const VAULT = '[{"name":"V"}]';

    describe("op2env: overwrite the local file?", () => {
        test.skipIf(!hasScript)(
            "No",
            async () => {
                fakeOp(VAULT, EXISTING_ITEM);
                const { code, output } = await run(OP2ENV, [".env.tpl"], "n\r");
                expect(output).toContain("Cancelled: nothing written");
                expect(output).not.toContain("inject called");
                expect(code).toBe(2);
                expect(readFileSync(join(dir, ".env"), "utf-8")).toBe("API_KEY=abc\n");
            },
            20000,
        );

        test.skipIf(!hasScript)(
            "Ctrl-C",
            async () => {
                fakeOp(VAULT, EXISTING_ITEM);
                const { code } = await run(OP2ENV, [".env.tpl"], "\x03");
                expect(code).toBe(2);
            },
            20000,
        );

        test.skipIf(!hasScript)(
            "Yes goes on to op inject",
            async () => {
                fakeOp(VAULT, EXISTING_ITEM);
                const { code, output } = await run(OP2ENV, [".env.tpl"], "y\r");
                // The fake op fails the inject, which proves the prompt let it through
                expect(output).toContain("inject called");
                expect(code).toBe(1);
            },
            20000,
        );

        test("no terminal to answer counts as declined", async () => {
            fakeOp(VAULT, EXISTING_ITEM);
            const { code, output } = await run(OP2ENV, [".env.tpl"]);
            expect(output).toContain("pass -f/--force");
            expect(code).toBe(2);
            expect(readFileSync(join(dir, ".env"), "utf-8")).toBe("API_KEY=abc\n");
        }, 20000);

        test("-f skips the prompt without a terminal", async () => {
            fakeOp(VAULT, EXISTING_ITEM);
            const { code, output } = await run(OP2ENV, [".env.tpl", "-f"]);
            expect(output).toContain("inject called");
            expect(code).toBe(1);
        }, 20000);
    });

    describe("env2op: update the existing 1Password item?", () => {
        test.skipIf(!hasScript)(
            "No",
            async () => {
                fakeOp(VAULT, EXISTING_ITEM);
                const { code, output } = await run(ENV2OP, [".env", "V", "Item"], "n\r");
                expect(output).toContain("Cancelled: nothing written");
                expect(output).not.toContain("item edit called");
                expect(code).toBe(2);
                expect(readFileSync(join(dir, ".env.tpl"), "utf-8")).toBe("API_KEY=op://V/i1/f1\n");
                expect(readFileSync(join(dir, ".env"), "utf-8")).toBe("API_KEY=abc\n");
            },
            20000,
        );

        test("no terminal to answer counts as declined", async () => {
            fakeOp(VAULT, EXISTING_ITEM);
            const { code, output } = await run(ENV2OP, [".env", "V", "Item"]);
            expect(output).not.toContain("item edit called");
            expect(code).toBe(2);
            // The .env keeps its content, with no "Pulled" stamp claiming it is in sync
            expect(readFileSync(join(dir, ".env"), "utf-8")).toBe("API_KEY=abc\n");
        }, 20000);
    });

    describe("env2op: create the missing vault?", () => {
        test("no terminal to answer counts as declined", async () => {
            fakeOp("[]", "[]");
            const { code, output } = await run(ENV2OP, [".env", "Missing", "Item"]);
            expect(output).not.toContain("vault create called");
            expect(code).toBe(2);
        }, 20000);
    });
});
