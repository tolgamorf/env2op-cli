#!/usr/bin/env bun

import pc from "picocolors";
import { runConvert } from "./commands/convert";

const pkg = await import("../package.json");
const args = process.argv.slice(2);

// Parse arguments
const flags = new Set<string>();
const positional: string[] = [];

for (const arg of args) {
    if (arg.startsWith("--")) {
        flags.add(arg.slice(2));
    } else if (arg.startsWith("-")) {
        // Handle short flags
        for (const char of arg.slice(1)) {
            flags.add(char);
        }
    } else {
        positional.push(arg);
    }
}

// Check for help/version flags first
const hasHelp = flags.has("h") || flags.has("help");
const hasVersion = flags.has("v") || flags.has("version");

if (hasVersion) {
    console.log(pkg.version);
    process.exit(0);
}

if (hasHelp || positional.length === 0) {
    showHelp();
    process.exit(0);
}

if (positional.length < 3) {
    showMissingArgsError(positional);
    process.exit(1);
}

// All positional args present, run the command
const [envFile, vault, itemName] = positional as [string, string, string];
await runConvert({
    envFile,
    vault,
    itemName,
    dryRun: flags.has("dry-run"),
    secret: flags.has("secret"),
    yes: flags.has("y") || flags.has("yes"),
});

function showHelp(): void {
    const name = pc.bold(pc.cyan("env2op"));
    const version = pc.dim(`v${pkg.version}`);

    console.log(`
${name} ${version}
${pkg.description}

${pc.bold("USAGE")}
  ${pc.cyan("$")} env2op ${pc.yellow("<env_file>")} ${pc.yellow("<vault>")} ${pc.yellow("<item_name>")} ${pc.dim("[options]")}

${pc.bold("ARGUMENTS")}
  ${pc.yellow("env_file")}     Path to .env file
  ${pc.yellow("vault")}        1Password vault name
  ${pc.yellow("item_name")}    Name for the Secure Note in 1Password

${pc.bold("OPTIONS")}
  ${pc.cyan("--dry-run")}      Preview actions without executing
  ${pc.cyan("--secret")}       Store all fields as password type (hidden)
  ${pc.cyan("-y, --yes")}      Skip confirmation prompts (auto-accept)
  ${pc.cyan("-h, --help")}     Show this help message
  ${pc.cyan("-v, --version")}  Show version

${pc.bold("EXAMPLES")}
  ${pc.dim("# Basic usage")}
  ${pc.cyan("$")} env2op .env.production Personal "MyApp - Production"

  ${pc.dim("# Preview without making changes")}
  ${pc.cyan("$")} env2op .env Personal "MyApp" --dry-run

  ${pc.dim("# Store as hidden password fields")}
  ${pc.cyan("$")} env2op .env Personal "MyApp" --secret

  ${pc.dim("# Skip confirmation prompts (for CI/scripts)")}
  ${pc.cyan("$")} env2op .env Personal "MyApp" -y

${pc.bold("DOCUMENTATION")}
  ${pc.dim("https://github.com/tolgamorf/env2op")}
`);
}

function showMissingArgsError(provided: string[]): void {
    const missing: string[] = [];

    if (provided.length < 1) missing.push("env_file");
    if (provided.length < 2) missing.push("vault");
    if (provided.length < 3) missing.push("item_name");

    console.log(`
${pc.red(pc.bold("Error:"))} Missing required arguments

${pc.bold("Usage:")} env2op ${pc.yellow("<env_file>")} ${pc.yellow("<vault>")} ${pc.yellow("<item_name>")} ${pc.dim("[options]")}

${pc.bold("Missing:")}
${missing.map((arg) => `  ${pc.red("•")} ${pc.yellow(arg)}`).join("\n")}

${pc.bold("Example:")}
  ${pc.cyan("$")} env2op .env.production Personal "MyApp - Production"

Run ${pc.cyan("env2op --help")} for more information.
`);
}
