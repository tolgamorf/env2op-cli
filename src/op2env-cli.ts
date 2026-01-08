import pc from "picocolors";
import { runInject } from "./commands/inject";
import { runUpdate } from "./commands/update";
import { getCliVersion, maybeShowUpdateNotification } from "./lib/update";
import { showUpdateNotification } from "./lib/update-prompts";
import { parseArgs } from "./utils/args";

const { flags, positional, options } = parseArgs(process.argv.slice(2));

// Check for flags
const hasHelp = flags.has("h") || flags.has("help");
const hasVersion = flags.has("v") || flags.has("version");
const hasUpdate = flags.has("update");

if (hasVersion) {
    console.log(getCliVersion());
    process.exit(0);
}

if (hasUpdate) {
    await runUpdate({
        force: flags.has("f") || flags.has("force"),
        verbose: flags.has("verbose"),
        cliName: "op2env",
    });
    process.exit(0);
}

if (hasHelp || positional.length === 0) {
    showHelp();
    process.exit(0);
}

// Run the inject command
const [templateFile] = positional as [string];
await runInject({
    templateFile,
    output: options.output,
    dryRun: flags.has("dry-run"),
    force: flags.has("f") || flags.has("force"),
    verbose: flags.has("verbose"),
});

// Check for updates after command execution (non-blocking)
await maybeShowUpdateNotification("op2env", showUpdateNotification);

function showHelp(): void {
    const name = pc.bold(pc.cyan("op2env"));
    const version = pc.dim(`v${getCliVersion()}`);

    console.log(`
${name} ${version}
Pull secrets from 1Password to generate .env files

${pc.bold("USAGE")}
  ${pc.cyan("$")} op2env ${pc.yellow("<template_file>")} ${pc.dim("[options]")}

${pc.bold("ARGUMENTS")}
  ${pc.yellow("template_file")}   Path to .env.tpl template file

${pc.bold("OPTIONS")}
  ${pc.cyan("-o, --output")}    Output .env path (default: template without .tpl)
  ${pc.cyan("-f, --force")}     Overwrite without prompting
  ${pc.cyan("    --dry-run")}   Preview actions without executing
  ${pc.cyan("    --verbose")}   Show op CLI output
  ${pc.cyan("    --update")}    Check for and install updates
  ${pc.cyan("-v, --version")}   Show version
  ${pc.cyan("-h, --help")}      Show this help message

${pc.bold("EXAMPLES")}
  ${pc.dim("# Basic usage - generates .env from .env.tpl")}
  ${pc.cyan("$")} op2env .env.tpl

  ${pc.dim("# Custom output path")}
  ${pc.cyan("$")} op2env .env.tpl -o .env.local

  ${pc.dim("# Preview without making changes")}
  ${pc.cyan("$")} op2env .env.tpl --dry-run

  ${pc.dim("# Overwrite existing .env without prompting")}
  ${pc.cyan("$")} op2env .env.tpl -f

${pc.bold("DOCUMENTATION")}
  ${pc.dim("https://github.com/tolgamorf/env2op-cli")}
`);
}
