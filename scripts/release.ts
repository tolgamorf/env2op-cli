#!/usr/bin/env bun

import { $ } from "bun";

async function release() {
    // Check for unstaged changes
    const status = await $`git status --porcelain`.text();
    if (status.trim()) {
        console.log("You have unstaged changes. Commit or stash them first.");
        process.exit(0);
    }

    // Run checks before releasing
    console.log("Running checks...");
    try {
        await $`bun run typecheck`.quiet();
        await $`bun run lint`.quiet();
    } catch {
        console.log("Checks failed. Fix errors before releasing.");
        process.exit(0);
    }

    // Read current version
    const pkg = await Bun.file("package.json").json();
    const currentVersion: string = pkg.version;

    // Increment patch version
    const parts = currentVersion.split(".").map(Number);
    parts[2]++;
    const newVersion = parts.join(".");

    // Update package.json
    pkg.version = newVersion;
    await Bun.write("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

    // Verify lint still passes after version bump
    try {
        await $`bun run lint`.quiet();
    } catch {
        console.log("Lint failed after version bump. Aborting release.");
        await $`git checkout package.json`.quiet();
        process.exit(0);
    }

    const tag = `v${newVersion}`;

    console.log(`Releasing ${tag}...`);

    // Commit, tag, and push
    await $`git add package.json`;
    await $`git commit -m ${tag}`;
    await $`git tag ${tag}`;
    await $`git push`;
    await $`git push origin ${tag}`;

    console.log(`Released ${tag}`);
}

release().catch((err) => {
    console.error(err);
    process.exit(1);
});
