import pc from "picocolors";
import { runConvert } from "./commands/convert";
import { runUpdate } from "./commands/update";
import { checkForUpdate } from "./lib/update";
import { showUpdateNotification } from "./lib/update-prompts";

const pkg = await import("../package.json");
const args = process.argv.slice(2);

// Parse arguments
const flags = new Set<string>();
const positional: string[] = [];
const options: Record<string, string> = {};

for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg === "-o" || arg === "--output") {
        const next = args[i + 1];
        if (next && !next.startsWith("-")) {
            options.output = next;
            i++; // skip next arg
        }
    } else if (arg.startsWith("--")) {
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

// Check for flags
const hasHelp = flags.has("h") || flags.has("help");
const hasVersion = flags.has("v") || flags.has("version");
const hasUpdate = flags.has("update");

if (hasVersion) {
    console.log(pkg.version);
    process.exit(0);
}

if (hasUpdate) {
    await runUpdate({
        force: flags.has("f") || flags.has("force"),
        verbose: flags.has("verbose"),
        cliName: "env2op",
    });
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
    output: options.output,
    dryRun: flags.has("dry-run"),
    secret: flags.has("secret"),
    force: flags.has("f") || flags.has("force"),
    verbose: flags.has("verbose"),
});

// Check for updates after command execution (non-blocking)
try {
    const updateResult = await checkForUpdate();
    if (updateResult.updateAvailable && !updateResult.isSkipped) {
        showUpdateNotification(updateResult, "env2op");
    }
} catch {
    // Silently ignore update check errors
}

function showHelp(): void {
    const name = pc.bold(pc.cyan("env2op"));
    const version = pc.dim(`v${pkg.version}`);

    console.log(`
${name} ${version}
${pkg.description}

${pc.bold("USAGE")}
  ${pc.cyan("$")} env2op ${pc.yellow("<env_file>")} ${pc.yellow("<vault>")} ${pc.yellow("<item_name>")} ${pc.dim("[options]")}

${pc.bold("ARGUMENTS")}
  ${pc.yellow("env_file")}        Path to .env file
  ${pc.yellow("vault")}           1Password vault name
  ${pc.yellow("item_name")}       Name for the Secure Note in 1Password

${pc.bold("OPTIONS")}
  ${pc.cyan("-o, --output")}    Output template path (default: <env_file>.tpl)
  ${pc.cyan("-f, --force")}     Skip confirmation prompts
  ${pc.cyan("    --dry-run")}   Preview actions without executing
  ${pc.cyan("    --secret")}    Store all fields as password type (hidden)
  ${pc.cyan("    --verbose")}   Show op CLI output
  ${pc.cyan("    --update")}    Check for and install updates
  ${pc.cyan("-v, --version")}   Show version
  ${pc.cyan("-h, --help")}      Show this help message

${pc.bold("EXAMPLES")}
  ${pc.dim("# Basic usage")}
  ${pc.cyan("$")} env2op .env.production Personal "MyApp - Production"

  ${pc.dim("# Custom output path")}
  ${pc.cyan("$")} env2op .env Personal "MyApp" -o secrets.tpl

  ${pc.dim("# Preview without making changes")}
  ${pc.cyan("$")} env2op .env Personal "MyApp" --dry-run

  ${pc.dim("# Store as hidden password fields")}
  ${pc.cyan("$")} env2op .env Personal "MyApp" --secret

  ${pc.dim("# Skip confirmation prompts (for CI/scripts)")}
  ${pc.cyan("$")} env2op .env Personal "MyApp" -f

${pc.bold("DOCUMENTATION")}
  ${pc.dim("https://github.com/tolgamorf/env2op-cli")}
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
