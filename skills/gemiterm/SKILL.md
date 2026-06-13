---
name: gemiterm
description: Google Gemini Terminal CLI wrapper for listing chats, fetching transcripts, exporting conversations, managing profiles, and sending messages via gemiterm new/continue. Use when the user asks to read, list, export, or interact with Gemini chat history, send or continue a Gemini chat from a terminal, or invokes "gemiterm" commands.
license: MIT
compatibility: opencode, claude-code, and any skill-compatible agent
metadata:
  tool: gemiterm
  runtime: bun
---

# GemiTerm — Google Gemini Terminal CLI

GemiTerm provides terminal access to Google Gemini chat history: list, fetch, export, delete, manage profiles, and send messages (`new`/`continue`). Commands that emit `--format json` are automation-friendly. `gemiterm new` and `gemiterm continue` are one-shot when given a message or `--prompt-file`; without either they drop into an interactive REPL.

## Install & invocation

GemiTerm is a **Bun-native** CLI. All `gemiterm` commands below assume the tool is available. The agent must resolve the executable at runtime:

### 1. Check if globally installed

```bash
gemiterm --version
```

If this succeeds, use `gemiterm` directly for all commands.

### 2. Fallback: `bunx gemiterm`

If not globally installed, use `bunx gemiterm` as a transparent fallback. This downloads and runs the latest version on first use:

```bash
bunx gemiterm --version
bunx gemiterm list --format json
bunx gemiterm auth
# … etc — prefix every command with "bunx"
```

### 3. Bun not installed

If `bun` is not available either, print the appropriate install command for the user's platform and stop:

| Platform | Command |
|----------|---------|
| macOS / Linux | `curl -fsSL https://bun.sh/install \| bash` |
| Windows | `powershell -c "irm bun.sh/install.ps1 \| iex"` |

After the user installs Bun, re-run from step 1. Auto-detect the platform from `$OSTYPE`, `uname`, or `process.platform`.

**To install gemiterm globally (optional):**

```bash
bun install gemiterm -g
gemiterm install-browser
gemiterm auth
```

## Commands

| Command | Purpose |
|---------|---------|
| `gemiterm new [message] [-f <path>]` | Start a chat; send the first message, print reply + chat_id |
| `gemiterm list [--all-profiles] [--profile <name>] [--limit N] [--sort recent\|oldest\|alpha] [--format json] [--out <path>]` | List chats with metadata |
| `gemiterm fetch <chat_id> [--format json] [--out <path>]` | Fetch full transcript for one chat |
| `gemiterm export <chat_id> --out <path> [--format md\|txt]` | Export one chat to a file |
| `gemiterm export-all --out-dir <dir> [--format md\|txt] [--parallel N]` | Bulk export all chats to a directory |
| `gemiterm delete <chat_id> [--confirm]` | Delete one chat (irreversible) |
| `gemiterm status [--format json]` | Show auth status and active profile |
| `gemiterm profile list\|default <name>\|add <name>\|delete <name>\|rename <name> <new_name>` | Manage Gemini profiles |
| `gemiterm continue <chat_id> [message] [-f <path>]` | Continue a chat: send a message (one-shot) or open the REPL |
| `gemiterm auth` | Run OAuth flow (interactive, not automation-friendly) |
| `gemiterm install-browser [--browser chrome\|firefox\|edge]` | Install Playwright browser for auth |

**Interactive commands** (`auth`, the bare `new`/`continue` REPL) open a browser or REPL — run manually, never from a script.

## Sending messages (`new` / `continue`)

`gemiterm new [message]` starts a chat; `gemiterm continue <chat_id> [message]` appends to one. Both write Gemini's reply to stdout and print the chat_id (e.g. `c_XXXX…`); both open an interactive **REPL** when no message is supplied.

**`--prompt-file <path>` / `-f`** reads the message from a file instead of a positional argument, bypassing the ~2048 UTF-16 code-unit shell limit. It is mutually exclusive with a positional message — error if both are given.

```bash
gemiterm new -f ./prompt.md
gemiterm continue <chat_id> -f ./follow-up.md
gemiterm new -f ./prompt.md --profile work   # global flags still apply
```

**Auto-spillover:** a positional message that exceeds the limit is transparently written to a temp file, sent, and deleted — so callers rarely need `--prompt-file` explicitly unless they control the file themselves.

> Full `new`/`continue` flag list in [REFERENCE.md](REFERENCE.md).

## Output formats

| Flag | Effect |
|------|--------|
| `--format json` | Machine-readable JSON for automation |
| `--format text` | Human-readable text (default for most commands) |
| `--out <path>` / `-o` | Write output to a file (`fetch`, `list`, `export`); Markdown by default for `export` |
| `--out-dir <dir>` / `-o` | Output directory for `export-all` |
| `--format md\|txt` | Export format for `export` and `export-all` (default: `md`) |

## Common patterns

**Find a chat by keyword:**
```bash
gemiterm list --format json | jq '.[] | select(.title | test("keyword"))'
```

**Export one chat:**
```bash
gemiterm fetch <chat_id> --format json > /tmp/chat.json
gemiterm export <chat_id> --out /tmp/chat.md
```

**Bulk analyze:**
```bash
gemiterm list --format json | jq -r '.[].id' | xargs -I {} gemiterm fetch {} --format json
```

**List recent chats across all profiles:**
```bash
gemiterm list --all-profiles --limit 10 --format json
```

**List chats in a single profile:**
```bash
gemiterm list --profile work --format json
```

## Troubleshooting

- **Auth errors:** run `gemiterm auth` manually to complete the OAuth flow.
- **Expired tokens:** GemiTerm refreshes automatically; re-run `auth` if it fails.
- **Rate limits:** space out bulk operations; see [REFERENCE.md](REFERENCE.md) for limits and retry behaviour.
- **UNAUTHENTICATED warnings:** Profile cookies may need refresh — run `gemiterm auth` to re-authenticate the affected profile.

## References

- [REFERENCE.md](REFERENCE.md) — flags, JSON schemas, env vars, exit codes, rate limits
- Project: https://github.com/expert-vision-software/gemiterm
