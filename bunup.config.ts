import { defineConfig } from "bunup";

export default defineConfig([
    // Library entry (no shebang, with types)
    {
        name: "library",
        entry: ["src/index.ts"],
        format: ["esm"],
        target: "node",
        outDir: "dist",
        clean: true,
        splitting: false,
        dts: true,
    },
    // CLI entries (with shebang, no types)
    {
        name: "cli",
        entry: ["src/cli.ts", "src/op2env-cli.ts"],
        format: ["esm"],
        target: "node",
        outDir: "dist",
        clean: false, // Don't clean, library already output
        splitting: false,
        banner: "#!/usr/bin/env node",
        dts: false,
    },
]);
