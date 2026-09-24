import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Exit codes a caller relies on, from the real env2op/op2env bins run as child processes
 * against a fake `op`:
 *   2   declined: No at a prompt, or no terminal to answer it (nothing written)
 *   130 cancelled: Escape or Ctrl-C at a prompt (nothing written), or Ctrl-C while running
 */
const ROOT = join(import.meta.dir, "../..");
const ENV2OP = join(ROOT, "src/cli.ts");
const OP2ENV = join(ROOT, "src/op2env-cli.ts");
const hasScript = process.platform === "linux" && Bun.which("script") !== null;

const EXISTING_ITEM = '[{"id":"i1","title":"Item"}]';
const VAULT = '[{"name":"V"}]';
const KEYS = { yes: "y\r", no: "n\r", escape: "\x1b", ctrlC: "\x03" };

let dir: string;

/**
 * A fake `op` running the given `case "$1"` branches. It ignores SIGINT, like an `op` call
 * that completes anyway, or one Ctrl-C lands between; any other call fails loudly.
 */
function writeFakeOp(branches: string): void {
    const bin = join(dir, "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(
        join(bin, "op"),
        `#!/bin/sh
trap '' INT
case "$1" in
  whoami) echo '{}' ;;
${branches}
  *) echo "op $1 $2 called" >&2; exit 1 ;;
esac
`,
    );
    chmodSync(join(bin, "op"), 0o755);
}

/** A fake `op` with the given vault and item listings; any write fails loudly. */
function fakeOp(vaults: string, items: string): void {
    writeFakeOp(`  vault) [ "$2" = list ] && echo '${vaults}' || { echo "vault $2 called" >&2; exit 1; } ;;
  item) [ "$2" = list ] && echo '${items}' || { echo "item $2 called" >&2; exit 1; } ;;
  inject) echo "inject called" >&2; exit 1 ;;`);
}

function envFor(): Record<string, string | undefined> {
    return {
        ...process.env,
        PATH: `${join(dir, "bin")}:${process.env.PATH}`,
        TMPDIR: join(dir, "tmp"),
        ENV2OP_NO_UPDATE_CHECK: "1",
        NO_COLOR: "1",
    };
}

/** Collect a stream into a string, calling `onText` with everything read so far as it grows. */
async function readAll(stream: ReadableStream<Uint8Array>, onText: (text: string) => void): Promise<string> {
    let text = "";
    const decoder = new TextDecoder();
    for await (const chunk of stream) {
        text += decoder.decode(chunk, { stream: true });
        onText(text);
    }
    return text;
}

/**
 * Run a bin. With `keys`, it runs under a pseudo-terminal (via `script`) and the keys are
 * typed once `typeWhen` is on screen (by default, the prompt); without, stdin is closed and
 * there is no terminal.
 */
async function run(
    bin: string,
    args: string[],
    keys?: string,
    typeWhen = "Yes / ",
): Promise<{ code: number; output: string }> {
    if (keys === undefined) {
        const proc = Bun.spawn(["bun", "run", bin, ...args], {
            cwd: dir,
            env: envFor(),
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
        env: envFor(),
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
    });

    // Type only once `typeWhen` is on screen. clack puts the terminal in raw mode before it
    // draws a prompt or starts a spinner, so the keys then reach it; sent any earlier, Ctrl-C
    // would be a real SIGINT and a letter would sit in the line buffer instead.
    let typed = false;
    const output = await readAll(proc.stdout, (text) => {
        if (!typed && text.includes(typeWhen)) {
            proc.stdin.write(keys);
            proc.stdin.flush();
            typed = true;
        }
    });
    const code = await proc.exited;
    proc.stdin.end();
    return { code, output: output + (await new Response(proc.stderr).text()) };
}

/**
 * Run a bin without a terminal and send it SIGINT, as Ctrl-C would, once `ready` is true
 * (checked against its output as it grows, and every 50ms).
 */
async function interrupt(
    bin: string,
    args: string[],
    ready: (output: string) => boolean,
): Promise<{ code: number; output: string }> {
    const proc = Bun.spawn(["bun", "run", bin, ...args], {
        cwd: dir,
        env: envFor(),
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
    });
    let sent = false;
    let seen = "";
    const send = () => {
        if (!sent && ready(seen)) {
            sent = true;
            proc.kill("SIGINT");
        }
    };
    const poll = setInterval(send, 50);
    const [output, stderr] = await Promise.all([
        readAll(proc.stdout, (text) => {
            seen = text;
            send();
        }),
        new Response(proc.stderr).text(),
    ]);
    clearInterval(poll);
    return { code: await proc.exited, output: output + stderr };
}

const envFile = () => readFileSync(join(dir, ".env"), "utf-8");
const templateFile = () => readFileSync(join(dir, ".env.tpl"), "utf-8");
const tempTemplates = () => readdirSync(join(dir, "tmp")).filter((f) => f.startsWith("env2op-template-"));

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "env2op-decline-"));
    mkdirSync(join(dir, "tmp"));
    writeFileSync(join(dir, ".env"), "API_KEY=abc\n");
    writeFileSync(join(dir, ".env.tpl"), "API_KEY=op://V/i1/f1\n");
});

afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(process.platform === "win32")("prompts: No exits 2, a cancel exits 130, nothing written", () => {
    describe("op2env: overwrite the local file?", () => {
        test.skipIf(!hasScript)(
            "No exits 2",
            async () => {
                fakeOp(VAULT, EXISTING_ITEM);
                const { code, output } = await run(OP2ENV, [".env.tpl"], KEYS.no);
                expect(output).toContain("Cancelled: nothing written");
                expect(output).not.toContain("inject called");
                expect(code).toBe(2);
                expect(envFile()).toBe("API_KEY=abc\n");
            },
            20000,
        );

        test.skipIf(!hasScript)(
            "Ctrl-C exits 130",
            async () => {
                fakeOp(VAULT, EXISTING_ITEM);
                const { code, output } = await run(OP2ENV, [".env.tpl"], KEYS.ctrlC);
                expect(output).not.toContain("inject called");
                expect(code).toBe(130);
                expect(envFile()).toBe("API_KEY=abc\n");
            },
            20000,
        );

        test.skipIf(!hasScript)(
            "Escape exits 130",
            async () => {
                fakeOp(VAULT, EXISTING_ITEM);
                const { code } = await run(OP2ENV, [".env.tpl"], KEYS.escape);
                expect(code).toBe(130);
                expect(envFile()).toBe("API_KEY=abc\n");
            },
            20000,
        );

        test.skipIf(!hasScript)(
            "Yes goes on to op inject",
            async () => {
                fakeOp(VAULT, EXISTING_ITEM);
                const { code, output } = await run(OP2ENV, [".env.tpl"], KEYS.yes);
                // The fake op fails the inject, which proves the prompt let it through
                expect(output).toContain("inject called");
                expect(code).toBe(1);
            },
            20000,
        );

        test("no terminal to answer exits 2", async () => {
            fakeOp(VAULT, EXISTING_ITEM);
            const { code, output } = await run(OP2ENV, [".env.tpl"]);
            expect(output).toContain("pass -f/--force");
            expect(code).toBe(2);
            expect(envFile()).toBe("API_KEY=abc\n");
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
            "No exits 2",
            async () => {
                fakeOp(VAULT, EXISTING_ITEM);
                const { code, output } = await run(ENV2OP, [".env", "V", "Item"], KEYS.no);
                expect(output).toContain("Cancelled: nothing written");
                expect(output).not.toContain("item edit called");
                expect(code).toBe(2);
                expect(templateFile()).toBe("API_KEY=op://V/i1/f1\n");
                expect(envFile()).toBe("API_KEY=abc\n");
            },
            20000,
        );

        test.skipIf(!hasScript)(
            "Ctrl-C exits 130",
            async () => {
                fakeOp(VAULT, EXISTING_ITEM);
                const { code, output } = await run(ENV2OP, [".env", "V", "Item"], KEYS.ctrlC);
                expect(output).not.toContain("item edit called");
                expect(code).toBe(130);
                expect(templateFile()).toBe("API_KEY=op://V/i1/f1\n");
                expect(envFile()).toBe("API_KEY=abc\n");
            },
            20000,
        );

        test("no terminal to answer exits 2", async () => {
            fakeOp(VAULT, EXISTING_ITEM);
            const { code, output } = await run(ENV2OP, [".env", "V", "Item"]);
            expect(output).not.toContain("item edit called");
            expect(code).toBe(2);
            // The .env keeps its content, with no "Pulled" stamp claiming it is in sync
            expect(envFile()).toBe("API_KEY=abc\n");
        }, 20000);
    });

    describe("env2op: create the missing vault?", () => {
        test.skipIf(!hasScript)(
            "No exits 2",
            async () => {
                fakeOp("[]", "[]");
                const { code, output } = await run(ENV2OP, [".env", "Missing", "Item"], KEYS.no);
                expect(output).not.toContain("vault create called");
                expect(code).toBe(2);
            },
            20000,
        );

        test.skipIf(!hasScript)(
            "Ctrl-C exits 130",
            async () => {
                fakeOp("[]", "[]");
                const { code, output } = await run(ENV2OP, [".env", "Missing", "Item"], KEYS.ctrlC);
                expect(output).not.toContain("vault create called");
                expect(code).toBe(130);
            },
            20000,
        );

        test("no terminal to answer exits 2", async () => {
            fakeOp("[]", "[]");
            const { code, output } = await run(ENV2OP, [".env", "Missing", "Item"]);
            expect(output).not.toContain("vault create called");
            expect(code).toBe(2);
        }, 20000);
    });
});

describe.skipIf(process.platform === "win32")("Ctrl-C while a command runs exits 130 and stops it", () => {
    // On a terminal, a running clack spinner reads Ctrl-C and Escape as keys and answers
    // them with process.exit(0), so a cancelled push used to report success
    const slowItemList = () =>
        writeFakeOp(`  vault) echo '${VAULT}' ;;
  item) case "$2" in
    list) sleep 2; echo '[]' ;;
    *) echo "item $2 called" >&2; exit 1 ;;
  esac ;;`);

    test.skipIf(!hasScript)(
        "Ctrl-C during a spinner on a terminal",
        async () => {
            slowItemList();
            const { code, output } = await run(ENV2OP, [".env", "V", "Item"], KEYS.ctrlC, "Checking for item");
            expect(output).not.toContain("item create called");
            expect(code).toBe(130);
            expect(templateFile()).toBe("API_KEY=op://V/i1/f1\n");
            expect(envFile()).toBe("API_KEY=abc\n");
        },
        20000,
    );

    test.skipIf(!hasScript)(
        "Escape during a spinner on a terminal",
        async () => {
            slowItemList();
            const { code, output } = await run(ENV2OP, [".env", "V", "Item"], KEYS.escape, "Checking for item");
            expect(output).not.toContain("item create called");
            expect(code).toBe(130);
        },
        20000,
    );

    test("SIGINT stops env2op instead of going on to push", async () => {
        // A clack spinner's own SIGINT handler used to swallow this: the spinner said
        // "Canceled" and env2op went on to create the item and write the template
        writeFakeOp(`  vault) echo '${VAULT}' ;;
  item) case "$2" in
    list) sleep 2; echo '[]' ;;
    *) echo "item $2 called" >&2; exit 1 ;;
  esac ;;`);
        const { code, output } = await interrupt(ENV2OP, [".env", "V", "Item"], (out) =>
            out.includes("Checking for item"),
        );
        expect(output).toContain("Interrupted");
        expect(output).not.toContain("item create called");
        expect(code).toBe(130);
        expect(templateFile()).toBe("API_KEY=op://V/i1/f1\n");
        expect(envFile()).toBe("API_KEY=abc\n");
    }, 20000);

    test("env2op deletes the temp file holding the values", async () => {
        // SIGINT arrives while `op item create` is reading the plaintext template
        writeFakeOp(`  vault) echo '${VAULT}' ;;
  item) case "$2" in
    list) echo '[]' ;;
    create) sleep 3 ;;
    *) echo "item $2 called" >&2; exit 1 ;;
  esac ;;`);
        const { code } = await interrupt(ENV2OP, [".env", "V", "Item"], () => tempTemplates().length > 0);
        expect(code).toBe(130);
        expect(tempTemplates()).toEqual([]);
    }, 20000);

    test("op2env stops while op inject runs", async () => {
        writeFakeOp("  inject) sleep 3 ;;");
        rmSync(join(dir, ".env"));
        const { code, output } = await interrupt(OP2ENV, [".env.tpl"], (out) => out.includes("Pulling secrets"));
        expect(output).toContain("Interrupted");
        expect(code).toBe(130);
    }, 20000);
});
