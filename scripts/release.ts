#!/usr/bin/env bun

import { $ } from "bun";

async function getLastTag(): Promise<string | null> {
    try {
        const tag = await $`git describe --tags --abbrev=0`.quiet().text();
        return tag.trim();
    } catch {
        return null;
    }
}

interface Commit {
    hash: string;
    subject: string;
    body: string;
}

async function getCommitsSinceTag(tag: string | null): Promise<Commit[]> {
    try {
        const range = tag ? `${tag}..HEAD` : "HEAD";
        // Use a delimiter to separate commits
        const delimiter = "---COMMIT---";
        const format = `${delimiter}%n%h%n%s%n%b`;
        const log = await $`git log ${range} --format=${format}`.quiet().text();

        return log
            .split(delimiter)
            .filter((block) => block.trim().length > 0)
            .map((block) => {
                const lines = block.trim().split("\n");
                const hash = lines[0] ?? "";
                const subject = lines[1] ?? "";
                const body = lines.slice(2).join("\n").trim();
                return { hash, subject, body };
            });
    } catch {
        return [];
    }
}

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

    const tag = `v${newVersion}`;
    const lastTag = await getLastTag();

    // Show commits since last release
    const commits = await getCommitsSinceTag(lastTag);
    if (commits.length > 0) {
        console.log("");
        console.log(`Changes since ${lastTag ?? "initial commit"}:`);
        console.log("─".repeat(50));
        for (const commit of commits) {
            console.log(`  • ${commit.subject}`);
        }
        console.log("─".repeat(50));
        console.log("");
    }

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

    // Build release notes
    const noteSections: string[] = [];

    if (commits.length > 0) {
        const commitNotes = commits
            .map((commit) => {
                let note = `### ${commit.subject}\n`;
                if (commit.body) {
                    // Indent body lines for better formatting
                    const bodyLines = commit.body
                        .split("\n")
                        .map((line) => line.trim())
                        .filter((line) => line.length > 0);
                    if (bodyLines.length > 0) {
                        note += `\n${bodyLines.map((line) => `- ${line}`).join("\n")}\n`;
                    }
                }
                return note;
            })
            .join("\n");
        noteSections.push(commitNotes);
    }

    // Add installation instructions
    const installInstructions = `## Installation

\`\`\`bash
# Install globally
bun install -g env2op

# Or run directly with bunx
bunx env2op .env <vault> "<item_name>"
bunx op2env .env.tpl
\`\`\``;
    noteSections.push(installInstructions);

    const releaseNotes = noteSections.join("\n---\n\n");

    console.log(`Releasing ${tag}...`);

    // Commit, tag, and push
    await $`git add package.json`;
    await $`git commit -m ${tag}`;
    await $`git push`;

    // Create GitHub release with notes
    if (releaseNotes) {
        await $`gh release create ${tag} --title ${tag} --notes ${releaseNotes}`;
    } else {
        await $`gh release create ${tag} --title ${tag} --generate-notes`;
    }

    console.log(`Released ${tag}`);
}

release().catch((err) => {
    console.error(err);
    process.exit(1);
});
