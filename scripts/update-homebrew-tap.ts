#!/usr/bin/env bun

import { $ } from "bun";

const HOMEBREW_TAP_PATH = "./homebrew-tap";

function generateFormula(version: string, sha256: string, versioned: boolean): string {
    const className = versioned ? `Env2opCliAT${version.replace(/\./g, "_")}` : "Env2opCli";

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

async function fetchSha256(version: string): Promise<string> {
    const url = `https://registry.npmjs.org/@tolgamorf/env2op-cli/-/env2op-cli-${version}.tgz`;
    console.log(`Fetching ${url}...`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch tarball: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const hash = new Bun.CryptoHasher("sha256");
    hash.update(new Uint8Array(buffer));
    return hash.digest("hex");
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

async function main() {
    const version = process.argv[2];

    if (!version) {
        console.log("Usage: bun run scripts/update-homebrew-tap.ts <version>");
        console.log("Example: bun run scripts/update-homebrew-tap.ts 0.2.0");
        process.exit(1);
    }

    console.log(`Updating Homebrew tap for v${version}...`);

    const sha256 = await fetchSha256(version);
    console.log(`SHA256: ${sha256}`);

    await updateHomebrewTap(version, sha256);
    console.log("Homebrew tap updated!");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
