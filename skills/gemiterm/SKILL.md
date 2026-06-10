---
name: gemiterm
description: Google Gemini Terminal CLI wrapper for listing chats, fetching transcripts, exporting conversations, and managing profiles via the gemiterm Python CLI. Use when the user asks to read, list, export, or interact with Gemini chat history from a terminal, or invokes "gemiterm" commands.
license: MIT
compatibility: opencode, claude-code, and any skill-compatible agent
metadata:
  tool: gemiterm
---

# GemiTerm — Google Gemini Terminal CLI

GemiTerm provides terminal access to Google Gemini chat history: list, fetch, export, delete, and manage profiles. Commands that emit `--format json` are automation-friendly; `auth` and `continue` require interactive flows.

## Install check

```bash
gemiterm --version
```

If missing:

```bash
pipx install gemiterm
gemiterm install-browser
gemiterm auth
```

## Commands

| Command | Purpose |
|---------|---------|
| `gemiterm list [--all-profiles] [--limit N] [--sort recent\|oldest\|alpha] [--format json]` | List chats with metadata |
| `gemiterm fetch <chat_id> [--format json]` | Fetch full transcript for one chat |
| `gemiterm export <chat_id> --output <path> [--format md\|txt]` | Export one chat to a file |
| `gemiterm export-all --output <dir> [--format md\|txt] [--parallel N]` | Bulk export all chats to a directory |
| `gemiterm delete <chat_id> [--confirm]` | Delete one chat (irreversible) |
| `gemiterm status [--format json]` | Show auth status and active profile |
| `gemiterm profile list\|default <name>\|add <name>\|delete <name>\|rename <name> <new_name>` | Manage Gemini profiles |
| `gemiterm continue <chat_id>` | Resume chat interactively (not automation-friendly) |
| `gemiterm auth` | Run OAuth flow (interactive, not automation-friendly) |
| `gemiterm install-browser [--browser chrome\|firefox\|edge]` | Install Playwright browser for auth |

**Interactive commands** (`auth`, `continue`) open a browser or REPL — run manually, never from a script.

## Output formats

| Flag | Effect |
|------|--------|
| `--format json` | Machine-readable JSON for automation |
| `--format text` | Human-readable text (default for most commands) |
| `--output <path>` | Write export to file (Markdown by default) |
| `--format md\|txt` | Export format for `export` and `export-all` (default: `md`) |

## Common patterns

**Find a chat by keyword:**
```bash
gemiterm list --format json | jq '.[] | select(.title | test("keyword"))'
```

**Export one chat:**
```bash
gemiterm fetch <chat_id> --format json > /tmp/chat.json
gemiterm export <chat_id> --output /tmp/chat.md
```

**Bulk analyze:**
```bash
gemiterm list --format json | jq -r '.[].id' | xargs -I {} gemiterm fetch {} --format json
```

**List recent chats across all profiles:**
```bash
gemiterm list --all-profiles --limit 10 --format json
```

## Troubleshooting

- **Auth errors:** run `gemiterm auth` manually to complete the OAuth flow.
- **Expired tokens:** GemiTerm refreshes automatically; re-run `auth` if it fails.
- **Rate limits:** space out bulk operations; see [REFERENCE.md](REFERENCE.md) for limits and retry behaviour.
- **UNAUTHENTICATED warnings:** Profile cookies may need refresh — run `gemiterm auth` to re-authenticate the affected profile.

## References

- [REFERENCE.md](REFERENCE.md) — flags, JSON schemas, env vars, exit codes, rate limits
- Project: https://github.com/expert-vision-software/gemiterm
