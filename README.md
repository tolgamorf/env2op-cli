# 🔐 env2op ⇄ op2env

### Push `.env` files to [1Password](https://1password.com) and pull them back with two simple commands.

[![npm version](https://img.shields.io/npm/v/@tolgamorf/env2op-cli)](https://www.npmjs.com/package/@tolgamorf/env2op-cli)
![GitHub Release Date](https://img.shields.io/github/release-date/tolgamorf/env2op-cli)
[![npm downloads](https://img.shields.io/npm/dm/@tolgamorf/env2op-cli)](https://www.npmjs.com/package/@tolgamorf/env2op-cli)
[![install size](https://packagephobia.com/badge?p=@tolgamorf/env2op-cli@0.2.2)](https://packagephobia.com/result?p=@tolgamorf/env2op-cli@0.2.2)
[![GitHub last commit](https://img.shields.io/github/last-commit/tolgamorf/env2op-cli)](https://github.com/tolgamorf/env2op-cli/commits/main)
[![CI](https://github.com/tolgamorf/env2op-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/tolgamorf/env2op-cli/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<!--
[![Bun](https://img.shields.io/badge/Bun-compatible-fbf0df.svg)](https://bun.sh/)
[![GitHub commits since latest release]](https://img.shields.io/github/commits-since/tolgamorf/env2op-cli/latest)
[![GitHub stars](https://img.shields.io/github/stars/tolgamorf/env2op-cli)](https://github.com/tolgamorf/env2op-cli/stargazers)
-->

![env2op demo](./demo/env2op-demo.gif)

## Installation

### Homebrew (macOS/Linux)

```bash
brew tap tolgamorf/tap
brew install env2op-cli
```

Or in a single command:

```bash
brew install tolgamorf/tap/env2op-cli
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
