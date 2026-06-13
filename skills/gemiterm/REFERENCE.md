# GemiTerm CLI Reference

Complete command reference for GemiTerm CLI. Loaded on demand by [SKILL.md](SKILL.md).

> **Runtime note:** GemiTerm is a Bun-native application. All commands below assume `gemiterm` is available. If not globally installed, prefix every command with `bunx` (e.g. `bunx gemiterm list --format json`). See [SKILL.md](SKILL.md) > "Install & invocation" for the full resolution flow.

## Contents

- [Commands](#commands)
  - [`gemiterm auth`](#gemiterm-auth)
  - [`gemiterm list`](#gemiterm-list)
  - [`gemiterm fetch <chat_id>`](#gemiterm-fetch-chat_id)
  - [`gemiterm export <chat_id>`](#gemiterm-export-chat_id)
  - [`gemiterm export-all`](#gemiterm-export-all)
  - [`gemiterm delete <chat_id>`](#gemiterm-delete-chat_id)
  - [`gemiterm status`](#gemiterm-status)
  - [`gemiterm profile`](#gemiterm-profile)
  - [`gemiterm continue <chat_id>`](#gemiterm-continue-chat_id)
  - [`gemiterm install-browser`](#gemiterm-install-browser)
- [Global Flags](#global-flags)
- [Exit Codes](#exit-codes)
- [Environment Variables](#environment-variables)
- [Config File](#config-file)
- [Rate Limits](#rate-limits)

---

## Commands

### `gemiterm auth`

Authenticate with Google Gemini API.

**Usage:**
```bash
gemiterm auth
```

**Notes:**
- Interactive command requiring browser
- Opens OAuth flow in default browser
- Must be run once per profile
- Not automation-friendly

**Flags:** None

---

### `gemiterm list`

List all chats.

**Usage:**
```bash
gemiterm list [options]
```

**Flags:**
- `--format json|text` - Output format (default: text)
- `--limit N` - Maximum number of chats to return
- `--reverse` - Reverse sort order
- `--all-profiles` - List chats across all configured profiles
- `--sort recent|oldest|alpha` - Sort order (default: recent)
- `--out <path>` / `-o` - Write the listing to a file instead of stdout

**Examples:**
```bash
gemiterm list
gemiterm list --format json
gemiterm list --format json --limit 10
gemiterm list --format json --limit 5 --reverse
gemiterm list --all-profiles --limit 10 --format json
gemiterm list --sort oldest --format json
gemiterm list --all-profiles --sort alpha --format json
```

**Output (JSON):**
```json
[
  {
    "id": "abc123def456",
    "title": "Python debugging help",
    "created_at": "2025-05-15T10:30:00Z",
    "updated_at": "2025-05-15T11:45:00Z",
    "message_count": 42
  }
]
```

---

### `gemiterm fetch <chat_id>`

Fetch transcript for a specific chat.

**Usage:**
```bash
gemiterm fetch <chat_id> [options]
```

**Arguments:**
- `chat_id` - The Gemini chat_id (required)

**Flags:**
- `--format json|text` - Output format (default: text)
- `--out <path>` / `-o` - Write transcript to a file instead of stdout

**Examples:**
```bash
gemiterm fetch abc123def456
gemiterm fetch abc123def456 --format json
gemiterm fetch abc123def456 --format json --out /tmp/chat.json
```

**Output (JSON):**
```json
{
  "id": "abc123def456",
  "title": "Python debugging help",
  "created_at": "2025-05-15T10:30:00Z",
  "updated_at": "2025-05-15T11:45:00Z",
  "messages": [
    {
      "role": "user",
      "content": "How do I debug this?",
      "timestamp": "2025-05-15T10:30:00Z"
    },
    {
      "role": "model",
      "content": "Let me help you...",
      "timestamp": "2025-05-15T10:30:05Z"
    }
  ]
}
```

---

### `gemiterm export <chat_id>`

Export a chat to a file.

**Usage:**
```bash
gemiterm export <chat_id> --out <path>
```

**Arguments:**
- `chat_id` - The Gemini chat_id (required)

**Flags:**
- `--out <path>` / `-o` - Output file path (required)
- `--format md|txt` - Export format (default: md)

**Examples:**
```bash
gemiterm export abc123def456 --out /tmp/chat.md
gemiterm export abc123def456 --out /tmp/chat.txt --format txt
```

**Output Format (Markdown):**
```markdown
# Python debugging help

## User (2025-05-15 10:30)
How do I debug this?

## Model (2025-05-15 10:30)
Let me help you...
```

---

### `gemiterm export-all`

Export all chats to a directory.

**Usage:**
```bash
gemiterm export-all --out-dir <directory>
```

**Flags:**
- `--out-dir <directory>` / `-o` - Output directory path (required)
- `--format md|txt` - Export format (default: md)
- `--parallel N` - Number of parallel exports (default: 4)

**Examples:**
```bash
gemiterm export-all --out-dir /tmp/gemini/
gemiterm export-all --out-dir /tmp/chats/ --format txt
gemiterm export-all --out-dir /tmp/backup/ --parallel 2
```

**Output Structure:**
```
/tmp/gemini/
├── chat_abc123.md
├── chat_def456.md
└── chat_ghi789.md
```

---

### `gemiterm delete <chat_id>`

Delete a chat.

**Usage:**
```bash
gemiterm delete <chat_id>
```

**Arguments:**
- `chat_id` - The Gemini chat_id (required)

**Flags:**
- `--confirm` - Skip confirmation prompt

**Examples:**
```bash
gemiterm delete abc123def456
gemiterm delete abc123def456 --confirm
```

**Warning:** This operation is irreversible.

---

### `gemiterm status`

Check authentication status and profile information.

**Usage:**
```bash
gemiterm status
```

**Flags:**
- `--format json|text` - Output format (default: text)

**Examples:**
```bash
gemiterm status
gemiterm status --format json
```

**Output (Text):**
```
Authenticated: Yes
Profile: default
Email: user@gmail.com
Token expires: 2025-06-15T10:30:00Z
```

**Output (JSON):**
```json
{
  "authenticated": true,
  "profile": "default",
  "email": "user@gmail.com",
  "token_expires": "2025-06-15T10:30:00Z"
}
```

---

### `gemiterm profile`

Manage Gemini profiles.

**Usage:**
```bash
gemiterm profile [options]
```

**Flags:**
- `--set <name>` - Switch to profile
- `--list` - List all profiles
- `--create <name>` - Create new profile
- `--delete <name>` - Delete profile

**Examples:**
```bash
gemiterm profile --list
gemiterm profile --set work
gemiterm profile --create personal
gemiterm profile --delete old-profile
```

---

### `gemiterm continue <chat_id>`

Continue a chat (interactive mode).

**Usage:**
```bash
gemiterm continue <chat_id>
```

**Arguments:**
- `chat_id` - The Gemini chat_id (required)

**Notes:**
- Interactive command not suitable for automation
- Opens REPL for continued chat
- Requires manual input

---

### `gemiterm install-browser`

Install browser for authentication.

**Usage:**
```bash
gemiterm install-browser
```

**Flags:**
- `--browser chrome|firefox|edge` - Browser to install (default: chrome)

**Notes:**
- Run once during setup
- Installs Playwright browser
- Required for `gemiterm auth`

---

## Global Flags

These flags work with all commands:

- `--config <path>` - Custom config file path
- `--profile <name>` - Use specific profile
- `--verbose` - Enable verbose output
- `--quiet` - Suppress non-error output
- `--help` - Show help message
- `--version` - Show version info

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Authentication required |
| 3 | Chat not found |
| 4 | Invalid arguments |
| 5 | Rate limit exceeded |
| 6 | Network error |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMITERM_CONFIG` | Config file path | `~/.config/gemiterm/config.json` |
| `GEMITERM_DATA_DIR` | Data directory | `~/.local/share/gemiterm/` |
| `GEMITERM_CACHE_DIR` | Cache directory | `~/.cache/gemiterm/` |
| `GEMITERM_LOG_LEVEL` | Logging level | `INFO` |
| `BROWSER` | Browser for auth | System default |

## Config File

Location: `~/.config/gemiterm/config.json`

```json
{
  "profiles": {
    "default": {
      "email": "user@gmail.com",
      "access_token": "...",
      "refresh_token": "...",
      "token_expires": "2025-06-15T10:30:00Z"
    }
  },
  "current_profile": "default",
  "api_key": "...",
  "timeout": 60,
  "max_retries": 3
}
```

## Rate Limits

Google Gemini API enforces rate limits on the free tier:

| Limit | Default |
|-------|---------|
| Requests per minute | 60 |
| Requests per day | 1500 |
| Tokens per request | 2,000,000 |

> Reflects Gemini free-tier defaults at time of writing; verify with the latest Google AI docs.

GemiTerm implements automatic retry with exponential backoff.
