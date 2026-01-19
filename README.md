# 🔐 env2op ⇄ op2env

### Push `.env` files to [1Password](https://1password.com) and pull them back with two simple commands.

[![NPM version](https://img.shields.io/npm/v/@tolgamorf/env2op-cli?logo=npm&logoColor=white)](https://www.npmjs.com/package/@tolgamorf/env2op-cli)
[![Homebrew Formula Version](https://img.shields.io/github/v/release/tolgamorf/env2op-cli?label=homebrew&logo=homebrew&logoColor=white)](https://github.com/tolgamorf/homebrew-tap)
[![Scoop Version](https://img.shields.io/scoop/v/env2op-cli?bucket=https%3A%2F%2Fgithub.com%2Ftolgamorf%2Fscoop-bucket&logo=vanilla-extract&logoColor=white)](https://github.com/tolgamorf/scoop-bucket)
[![Chocolatey Version](https://img.shields.io/chocolatey/v/env2op-cli?logo=chocolatey&logoColor=white)](https://community.chocolatey.org/packages/env2op-cli)
[![WinGet Package Version](https://img.shields.io/winget/v/tolgamorf.env2op-cli?logo=data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbD0iI2ZmZiI+PHBhdGggZD0iTTEuNDg4IDQuMzI1YzAtLjY0Ny41MzUtMS4xNzIgMS4xOTUtMS4xNzJoMTguNjM0Yy42NiAwIDEuMTk1LjUyNSAxLjE5NSAxLjE3MnYxLjY5OUgxLjQ4OHYtMS43em0xLjQ4OC0zLjE1M0MyLjk3Ni41MjUgMy41MTEgMCA0LjE3MSAwSDE5LjgzYy42NiAwIDEuMTk1LjUyNSAxLjE5NSAxLjE3MnYxLjY1MkgyLjk3NlYxLjE3MnptMTkuODI5IDUuMTgxYy42NiAwIDEuMTk1LjUyNSAxLjE5NSAxLjE3MnYxNS4zMDNjMCAuNjQ3LS41MzUgMS4xNzItMS4xOTUgMS4xNzJIMS4xOTVDLjUzNSAyNCAwIDIzLjQ3NSAwIDIyLjgyOFY3LjUyNWMwLS42NDcuNTM1LTEuMTcyIDEuMTk1LTEuMTcyaDIxLjYxek0xMS45NjkgOS4yOTRjLS45NjkgMC0xLjUuNzY2LTEuNSAxLjYyNHY1LjExNmwtMS4wOTQtMS4wNDFjLS42MjUtLjYxMy0xLjUtLjczNi0yLjE4Ny0uMTIzLS44NzUuOTUtLjI1IDEuODM3LjI1IDIuMzZsMy4zNzUgMy4yNzdjLjIxMy4xODQuNjI1LjUyMSAxLjE1Ni41MjEuNTMxIDAgLjk0Mi0uMzM3IDEuMTU2LS41MmwzLjM3NS0zLjI3OWMuNS0uNTIyIDEuMTI1LTEuNDEuMjUtMi4zNTktLjY4Ny0uNjEzLTEuNTYyLS40OS0yLjE4Ny4xMjNsLTEuMDk0IDEuMDQxdi01LjExNmMwLS44NTgtLjUzMS0xLjYyNC0xLjUtMS42MjR6Ii8+PC9zdmc+)](https://github.com/microsoft/winget-pkgs/tree/master/manifests/t/tolgamorf/env2op-cli)


![env2op demo](./demo/env2op-demo.gif)

![GitHub Release Date](https://img.shields.io/github/release-date/tolgamorf/env2op-cli)
[![npm downloads](https://img.shields.io/npm/dm/@tolgamorf/env2op-cli)](https://www.npmjs.com/package/@tolgamorf/env2op-cli)
[![install size](https://packagephobia.com/badge?p=@tolgamorf/env2op-cli@0.2.2)](https://packagephobia.com/result?p=@tolgamorf/env2op-cli@0.2.2)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@tolgamorf/env2op-cli)](https://bundlephobia.com/package/@tolgamorf/env2op-cli)
[![GitHub last commit](https://img.shields.io/github/last-commit/tolgamorf/env2op-cli)](https://github.com/tolgamorf/env2op-cli/commits/main)
[![GitHub commits since latest release](https://img.shields.io/github/commits-since/tolgamorf/env2op-cli/latest)](https://github.com/tolgamorf/env2op-cli/commits/main)
[![Node.js](https://img.shields.io/node/v/@tolgamorf/env2op-cli?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/github/package-json/dependency-version/tolgamorf/env2op-cli/dev/typescript?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![ESM](https://img.shields.io/badge/ESM-only-F7DF1E?logo=javascript&logoColor=white)](https://nodejs.org/api/esm.html)
[![Bun](https://img.shields.io/badge/Bun-compatible-fbf0df.svg?logo=bun&logoColor=white)](https://bun.sh/)
[![Biome](https://img.shields.io/badge/Biome-linter-60A5FA?logo=biome&logoColor=white)](https://biomejs.dev/)
[![CI](https://github.com/tolgamorf/env2op-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/tolgamorf/env2op-cli/actions/workflows/ci.yml)
[![GitHub issues](https://img.shields.io/github/issues/tolgamorf/env2op-cli)](https://github.com/tolgamorf/env2op-cli/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/tolgamorf/env2op-cli/pulls)
[![GitHub License](https://img.shields.io/github/license/tolgamorf/env2op-cli)](https://github.com/tolgamorf/env2op-cli/blob/main/LICENSE)

---

<!--
[![Socket Badge](https://socket.dev/api/badge/npm/package/@tolgamorf/env2op-cli)](https://socket.dev/npm/package/@tolgamorf/env2op-cli)
[![GitHub stars](https://img.shields.io/github/stars/tolgamorf/env2op-cli)](https://github.com/tolgamorf/env2op-cli/stargazers)
-->

## Installation

### Homebrew (macOS/Linux)

```bash
brew tap tolgamorf/tap
brew install env2op-cli

# or in a single command:
brew install tolgamorf/tap/env2op-cli
```

### Scoop (Windows)

```powershell
scoop bucket add tolgamorf https://github.com/tolgamorf/scoop-bucket
scoop install env2op-cli
```

### Chocolatey (Windows)

```powershell
choco install env2op-cli
```

### WinGet (Windows)

```powershell
winget install tolgamorf.env2op-cli
```

### Package Managers (macOS/Linux/Windows)

#### Global installation

```bash
# Using bun
bun add -g @tolgamorf/env2op-cli

# Using npm
npm install -g @tolgamorf/env2op-cli

# Using pnpm
pnpm add -g @tolgamorf/env2op-cli
```

#### Running directly

```bash
# Using bun
bunx @tolgamorf/env2op-cli .env Personal "MyApp"

# Using npm
npx @tolgamorf/env2op-cli .env Personal "MyApp"

# Using pnpm
pnpm dlx @tolgamorf/env2op-cli .env Personal "MyApp"
```


## Prerequisites

- [1Password CLI](https://1password.com/downloads/command-line/) installed and signed in
- [Bun](https://bun.sh) runtime (for best performance)

## Commands

This package provides two commands:

| Command  | Description                                            |
|:--------:|--------------------------------------------------------|
| `env2op` | Push `.env` to 1Password, generate `.env.tpl` template |
| `op2env` | Pull secrets from 1Password using `.env.tpl` template  |

## env2op (Push)

Push environment variables to 1Password and generate a template file.

```bash
env2op <env_file> <vault> <item_name> [options]
```

### Examples for env2op

```bash
# Basic usage - creates a Secure Note and generates .env.tpl
env2op .env.production Personal "MyApp - Production"

# Custom output path for template
env2op .env Personal "MyApp" -o secrets.tpl

# Preview what would happen without making changes
env2op .env.production Personal "MyApp" --dry-run

# Store all fields as password type (hidden in 1Password)
env2op .env.production Personal "MyApp" --secret

# Skip confirmation prompts (useful for scripts/CI)
env2op .env.production Personal "MyApp" -f
```

### Options for env2op

| Flag            | Description                                           |
|----------------:|-------------------------------------------------------|
| `-o, --output`  | Output template path (default: `<env_file>.tpl`)      |
| `-f, --force`   | Skip confirmation prompts                             |
| `--dry-run`     | Preview actions without executing                     |
| `--secret`      | Store all fields as 'password' type (default: 'text') |
| `--verbose`     | Show op CLI output                                    |
| `--update`      | Check for and install updates                         |
| `-v, --version` | Show version                                          |
| `-h, --help`    | Show help                                             |

## op2env (Pull)

Pull secrets from 1Password to generate a `.env` file.

```bash
op2env <template_file> [options]
```

### Examples for op2env

```bash
# Basic usage - generates .env from .env.tpl
op2env .env.tpl

# Custom output path
op2env .env.tpl -o .env.local

# Preview without making changes
op2env .env.tpl --dry-run

# Overwrite existing .env without prompting
op2env .env.tpl -f
```

### Options for op2env

| Flag            | Description                                         |
|----------------:|-----------------------------------------------------|
| `-o, --output`  | Output .env path (default: template without `.tpl`) |
| `-f, --force`   | Overwrite without prompting                         |
| `--dry-run`     | Preview actions without executing                   |
| `--verbose`     | Show op CLI output                                  |
| `--update`      | Check for and install updates                       |
| `-v, --version` | Show version                                        |
| `-h, --help`    | Show help                                           |

## How It Works

1. **env2op** parses your `.env` file, creates a 1Password Secure Note, and generates a `.tpl` template
2. **op2env** reads the template and pulls current values from 1Password to create a `.env` file

You can also use the `op run` command to run processes with secrets injected:

```bash
op run --env-file .env.tpl -- npm start
```

## Field Types

By default, all fields are stored as `text` type (visible in 1Password). Use `--secret` to store them as `password` type (hidden by default, revealed on click).

## Example

Given this `.env` file:

```env
DATABASE_URL=postgres://localhost/myapp
API_KEY=sk-1234567890
DEBUG=true
```

Running:

```bash
env2op .env Personal "MyApp Secrets"
```

Creates a 1Password Secure Note with fields:

- `DATABASE_URL` (text)
- `API_KEY` (text)
- `DEBUG` (text)

And generates `.env.tpl` with UUID-based references (avoids naming conflicts):

```env
DATABASE_URL=op://abc123vaultid/xyz789itemid/def456fieldid
API_KEY=op://abc123vaultid/xyz789itemid/ghi012fieldid
DEBUG=op://abc123vaultid/xyz789itemid/jkl345fieldid
```

## Programmatic Usage

You can also use env2op as a library:

```typescript
import { parseEnvFile, createSecureNote, generateTemplateContent } from "@tolgamorf/env2op-cli";

const result = parseEnvFile(".env");
console.log(result.variables);
```

## License

MIT
