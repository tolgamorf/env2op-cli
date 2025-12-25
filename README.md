# env2op

Convert `.env` files to 1Password Secure Notes and generate template files for `op inject` and `op run`.

![env2op demo](demo/env2op-demo.gif)

## Installation

```bash
# Using bun
bun add -g @tolgamorf/env2op-cli

# Using npm
npm install -g @tolgamorf/env2op-cli

# Or run directly with bunx/npx
bunx @tolgamorf/env2op-cli .env Personal "MyApp"
```

## Prerequisites

- [1Password CLI](https://1password.com/downloads/command-line/) installed and signed in
- [Bun](https://bun.sh) runtime (for best performance)

## Usage

```bash
env2op <env_file> <vault> <item_name> [options]
```

### Examples

```bash
# Basic usage - creates a Secure Note and generates .env.tpl
env2op .env.production Personal "MyApp - Production"

# Preview what would happen without making changes
env2op .env.production Personal "MyApp" --dry-run

# Store all fields as password type (hidden in 1Password)
env2op .env.production Personal "MyApp" --secret

# Skip confirmation prompts (useful for scripts/CI)
env2op .env.production Personal "MyApp" -y
```

### Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview actions without executing |
| `--secret` | Store all fields as 'password' type (default: 'text') |
| `-y, --yes` | Skip confirmation prompts (auto-accept) |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

### Overwriting Existing Items

If an item with the same name already exists in the vault, env2op will prompt for confirmation before overwriting. Use `-y` or `--yes` to skip the prompt and auto-accept.

## How It Works

1. **Parses** your `.env` file to extract environment variables
2. **Creates** a 1Password Secure Note with all variables as fields
3. **Generates** a `.tpl` template file with `op://` references

## Using the Generated Template

After running env2op, you'll have a `.env.tpl` file with 1Password references:

```bash
# Inject secrets into a new .env file
op inject -i .env.tpl -o .env

# Run a command with secrets injected
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

And generates `.env.tpl`:

```env
DATABASE_URL=op://Personal/MyApp Secrets/DATABASE_URL
API_KEY=op://Personal/MyApp Secrets/API_KEY
DEBUG=op://Personal/MyApp Secrets/DEBUG
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
