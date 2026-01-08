#!/usr/bin/env bun

import { $ } from "bun";

const HOMEBREW_TAP_PATH = "./homebrew-tap";
const SCOOP_MANIFEST_PATH = "./manifests/scoop/env2op.json";
const WINGET_MANIFEST_PATH = "./manifests/winget/tolgamorf.env2op.yaml";

function generateFormula(version: string, sha256: string, versioned: boolean): string {
    const className = versioned ? `Env2opCliAT${version.replace(/\./g, "")}` : "Env2opCli";

    return `class ${className} < Formula
  desc "Push .env files to 1Password and pull them back"
  homepage "https://github.com/tolgamorf/env2op-cli"
  url "https://registry.npmjs.org/@tolgamorf/env2op-cli/-/env2op-cli-${version}.tgz"
  sha256 "${sha256}"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  def caveats
    <<~EOS
      env2op-cli requires the 1Password CLI.

      Install it with:
        brew install 1password-cli
    EOS
  end

  test do
    assert_match "Push .env files to 1Password", shell_output("#{bin}/env2op --help")
    assert_match "Pull secrets from 1Password", shell_output("#{bin}/op2env --help")
  end
end
`;
}

async function fetchSha256(version: string, maxRetries = 12): Promise<string> {
    const url = `https://registry.npmjs.org/@tolgamorf/env2op-cli/-/env2op-cli-${version}.tgz`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const response = await fetch(url);

        if (response.ok) {
            const buffer = await response.arrayBuffer();
            const hash = new Bun.CryptoHasher("sha256");
            hash.update(new Uint8Array(buffer));
            return hash.digest("hex");
        }

        if (response.status === 404 && attempt < maxRetries) {
            const waitTime = 15000; // 15s between retries (total ~3 min max wait)
            console.log(`  Package not yet available, retrying in ${waitTime / 1000}s... (${attempt}/${maxRetries})`);
            await Bun.sleep(waitTime);
            continue;
        }

        throw new Error(`Failed to fetch tarball: ${response.status}`);
    }

    throw new Error("Failed to fetch tarball after max retries");
}

async function updateHomebrewTap(version: string, sha256: string): Promise<void> {
    const formulaDir = `${HOMEBREW_TAP_PATH}/Formula`;

    // Write main formula (latest)
    const mainFormula = generateFormula(version, sha256, false);
    await Bun.write(`${formulaDir}/env2op-cli.rb`, mainFormula);

    // Write versioned formula
    const versionedFormula = generateFormula(version, sha256, true);
    await Bun.write(`${formulaDir}/env2op-cli@${version}.rb`, versionedFormula);

    // Commit and push
    await $`git -C ${HOMEBREW_TAP_PATH} add Formula/`;
    await $`git -C ${HOMEBREW_TAP_PATH} commit -m ${`v${version}`}`;
    await $`git -C ${HOMEBREW_TAP_PATH} push`;
}

async function fetchWindowsZipSha256(version: string, maxRetries = 30): Promise<string> {
    const url = `https://github.com/tolgamorf/env2op-cli/releases/download/v${version}/SHASUMS256.txt`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const response = await fetch(url, { redirect: "follow" });

        if (response.ok) {
            const content = await response.text();
            // Parse SHASUMS256.txt format: "hash  filename"
            const match = content.match(/^([a-f0-9]{64})\s+env2op-windows-x64\.zip/m);
            if (match) {
                return match[1];
            }
            throw new Error("Could not parse SHA256 from SHASUMS256.txt");
        }

        if (response.status === 404 && attempt < maxRetries) {
            const waitTime = 10000; // 10s between retries (total ~5 min max wait)
            console.log(
                `  SHASUMS256.txt not yet available, retrying in ${waitTime / 1000}s... (${attempt}/${maxRetries})`,
            );
            await Bun.sleep(waitTime);
            continue;
        }

        throw new Error(`Failed to fetch SHASUMS256.txt: ${response.status}`);
    }

    throw new Error("Failed to fetch SHASUMS256.txt after max retries");
}

async function updateScoopManifest(version: string, sha256: string): Promise<void> {
    const manifest = await Bun.file(SCOOP_MANIFEST_PATH).json();

    manifest.version = version;
    manifest.architecture["64bit"].url =
        `https://github.com/tolgamorf/env2op-cli/releases/download/v${version}/env2op-windows-x64.zip`;
    manifest.architecture["64bit"].hash = sha256;

    await Bun.write(SCOOP_MANIFEST_PATH, `${JSON.stringify(manifest, null, 4)}\n`);
}

async function updateWingetManifest(version: string, sha256: string): Promise<void> {
    let content = await Bun.file(WINGET_MANIFEST_PATH).text();

    // Update version
    content = content.replace(/^PackageVersion: .+$/m, `PackageVersion: ${version}`);

    // Update installer URL
    content = content.replace(
        /InstallerUrl: .+env2op-windows-x64\.zip$/m,
        `InstallerUrl: https://github.com/tolgamorf/env2op-cli/releases/download/v${version}/env2op-windows-x64.zip`,
    );

    // Update SHA256
    content = content.replace(/InstallerSha256: .+$/m, `InstallerSha256: ${sha256}`);

    await Bun.write(WINGET_MANIFEST_PATH, content);
}

async function updateWindowsManifests(version: string): Promise<void> {
    console.log("Waiting for Windows build to complete...");

    // Wait for Windows build workflow
    const tag = `v${version}`;
    let runId: number | null = null;

    for (let attempt = 1; attempt <= 24; attempt++) {
        const runs = await $`gh run list --workflow=build-windows.yml --limit=5 --json databaseId,displayTitle,status`
            .quiet()
            .json();
        const matchingRun = runs.find((run: { displayTitle: string }) => run.displayTitle === tag);
        if (matchingRun) {
            runId = matchingRun.databaseId;
            break;
        }
        console.log(`  Waiting for Windows build workflow to start... (${attempt}/24)`);
        await Bun.sleep(5000);
    }

    if (runId) {
        await $`gh run watch ${runId}`;
        console.log("Windows build workflow completed");
    } else {
        console.log("Warning: Could not find Windows build workflow run. Skipping manifest updates.");
        return;
    }

    // Fetch SHA256 of the Windows ZIP
    console.log("Fetching Windows ZIP SHA256...");
    const sha256 = await fetchWindowsZipSha256(version);
    console.log(`  SHA256: ${sha256}`);

    // Update manifests
    console.log("Updating Scoop manifest...");
    await updateScoopManifest(version, sha256);

    console.log("Updating Winget manifest...");
    await updateWingetManifest(version, sha256);

    // Commit and push manifest updates
    await $`git add ${SCOOP_MANIFEST_PATH} ${WINGET_MANIFEST_PATH}`;
    await $`git commit -m ${`chore: Update Windows manifests for v${version}`}`;
    await $`git push`;

    console.log("Windows manifests updated");
}

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

type BumpType = "patch" | "minor" | "major";

function bumpVersion(currentVersion: string, bumpType: BumpType): string {
    const parts = currentVersion.split(".").map(Number);
    switch (bumpType) {
        case "major":
            parts[0]++;
            parts[1] = 0;
            parts[2] = 0;
            break;
        case "minor":
            parts[1]++;
            parts[2] = 0;
            break;
        case "patch":
            parts[2]++;
            break;
    }
    return parts.join(".");
}

function isValidVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(version);
}

function parseVersionArg(arg: string | undefined, currentVersion: string): string {
    if (!arg || arg === "patch") {
        return bumpVersion(currentVersion, "patch");
    }
    if (arg === "minor") {
        return bumpVersion(currentVersion, "minor");
    }
    if (arg === "major") {
        return bumpVersion(currentVersion, "major");
    }
    if (isValidVersion(arg)) {
        return arg;
    }
    console.log(`Invalid version: ${arg}`);
    console.log("Usage: bun run release [patch|minor|major|x.y.z]");
    process.exit(1);
}

async function confirm(message: string): Promise<boolean> {
    process.stdout.write(`${message} [y/N] `);
    for await (const line of console) {
        const answer = line.trim().toLowerCase();
        return answer === "y" || answer === "yes";
    }
    return false;
}

function buildReleaseNotes(commits: Commit[]): string {
    const noteSections: string[] = [];

    if (commits.length > 0) {
        const commitNotes =
            "## What's New\n\n" +
            commits
                .map((commit) => {
                    let note = `### ${commit.subject}\n`;
                    if (commit.body) {
                        const bodyLines = commit.body
                            .split("\n")
                            .map((line) => line.trim())
                            .filter((line) => line.length > 0)
                            .map((line) => (line.startsWith("-") || line.startsWith("*") ? line : `- ${line}`));
                        if (bodyLines.length > 0) {
                            note += `\n${bodyLines.join("\n")}\n`;
                        }
                    }
                    return note;
                })
                .join("\n");
        noteSections.push(commitNotes);
    }

    const installInstructions = `## Installation

### Homebrew (macOS/Linux)

\`\`\`bash
brew install tolgamorf/tap/env2op-cli
\`\`\`

### Package Managers (macOS/Linux/Windows)

\`\`\`bash
# Using bun
bun add -g @tolgamorf/env2op-cli

# Using npm
npm install -g @tolgamorf/env2op-cli

# Using pnpm
pnpm add -g @tolgamorf/env2op-cli
\`\`\``;
    noteSections.push(installInstructions);

    return noteSections.join("\n---\n\n");
}

async function release() {
    const versionArg = process.argv[2];

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
    console.log("Checks passed.\n");

    // Read current version and determine new version
    const pkg = await Bun.file("package.json").json();
    const currentVersion: string = pkg.version;
    const newVersion = parseVersionArg(versionArg, currentVersion);
    const tag = `v${newVersion}`;
    const lastTag = await getLastTag();

    // Get commits and build release notes
    const commits = await getCommitsSinceTag(lastTag);
    const releaseNotes = buildReleaseNotes(commits);

    // Show release summary
    console.log("═".repeat(60));
    console.log("                     RELEASE SUMMARY");
    console.log("═".repeat(60));
    console.log("");
    console.log(`  Version:  ${currentVersion} → ${newVersion}`);
    console.log(`  Tag:      ${tag}`);
    console.log("");

    if (commits.length > 0) {
        console.log("─".repeat(60));
        console.log("  Changes:");
        console.log("─".repeat(60));
        for (const commit of commits) {
            console.log(`    • ${commit.subject}`);
        }
        console.log("");
    } else {
        console.log("  No commits since last release.");
        console.log("");
    }

    console.log("─".repeat(60));
    console.log("  Release Notes Preview:");
    console.log("─".repeat(60));
    console.log(
        releaseNotes
            .split("\n")
            .map((line) => `    ${line}`)
            .join("\n"),
    );
    console.log("");
    console.log("═".repeat(60));
    console.log("");

    // Confirm release
    const confirmed = await confirm("Proceed with release?");
    if (!confirmed) {
        console.log("Release cancelled.");
        process.exit(0);
    }

    console.log("");

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

    // Wait for the Publish workflow to complete (triggered by tag push)
    console.log("Waiting for npm publish workflow to complete...");

    // Get the commit SHA for the tag we just created
    const headSha = await $`git rev-parse HEAD`.text();
    const commitSha = headSha.trim();

    // Poll for the workflow run (it may take a moment to start)
    let runId: number | null = null;
    for (let attempt = 1; attempt <= 12; attempt++) {
        const runs = await $`gh run list --workflow=publish.yml --limit=5 --json databaseId,headSha,status`
            .quiet()
            .json();
        const matchingRun = runs.find((run: { headSha: string }) => run.headSha === commitSha);
        if (matchingRun) {
            runId = matchingRun.databaseId;
            break;
        }
        console.log(`  Waiting for workflow to start... (${attempt}/12)`);
        await Bun.sleep(5000);
    }

    if (runId) {
        await $`gh run watch ${runId}`;
        console.log("Publish workflow completed");
    } else {
        console.log("Warning: Could not find publish workflow run. Continuing with Homebrew update...");
    }

    // Update Homebrew tap
    console.log("Updating Homebrew tap...");
    const sha256 = await fetchSha256(newVersion);
    await updateHomebrewTap(newVersion, sha256);
    console.log("Homebrew tap updated");

    // Update Windows manifests
    await updateWindowsManifests(newVersion);
}

release().catch((err) => {
    console.error(err);
    process.exit(1);
});
