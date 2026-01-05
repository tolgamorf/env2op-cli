import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/cli.ts", "src/op2env-cli.ts"],
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    clean: true,
    splitting: false,
    banner: {
        js: "#!/usr/bin/env node",
    },
});
