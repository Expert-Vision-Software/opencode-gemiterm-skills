---
name: debate-with-gemini
description: Conduct structured multi-turn technical debates with Gemini AI via gemiterm CLI. Delegates a subagent to argue a position (for/against) autonomously for up to N turns. Use when user says "debate gemini", "argue with gemini", "have gemini defend/attack X", "continue debate", or wants a technical position stress-tested against Gemini. Triggers on: debate, argue, gemini, position, for/against, stress-test, counter-argument. Requires gemiterm CLI installed and authenticated.
license: MIT
compatibility: opencode, claude-code, and any skill-compatible agent
metadata:
  tool: gemiterm
  workflow: debate
  runtime: bun
---

# Debate with Gemini

## Quick Start

```
User: "Debate gemini on for/against using X. Context: docs/arch.md. 5 turns."

1. skill("gemiterm")                              — load CLI commands
2. gemiterm status                                — verify auth (or bunx gemiterm status)
3. Read docs/arch.md, build seeding prompt
4. gemiterm new "You argue AGAINST X. [context]"  — seed Gemini, capture chat_id
5. Build opening argument for the FOR position
6. Spawn subagent with template from REFERENCE.md
7. Subagent runs N turns, returns Debate Report
```

## Prerequisites

GemiTerm is a **Bun-native** CLI. Before running any commands, resolve the executable:

1. `gemiterm --version` — if this succeeds, use `gemiterm` directly.
2. If not found, use `bunx gemiterm` as a transparent fallback for all commands.
3. If `bun` is not installed, print the platform-appropriate install command and stop:

| Platform | Command |
|----------|---------|
| macOS / Linux | `curl -fsSL https://bun.sh/install \| bash` |
| Windows | `powershell -c "irm bun.sh/install.ps1 \| iex"` |

Then:

```bash
gemiterm status
```

If not connected: install gemiterm globally (`bun install gemiterm -g`), then `gemiterm install-browser && gemiterm auth`.

## Inputs

If any required input is missing, ask the user via the standard opencode chat interface before continuing.

| Input | Required | Description |
|-------|----------|-------------|
| `{{TOPIC}}` | Yes | Two-sided topic (e.g., "for/against using Mastra as foundation SDK") |
| `{{BG_CONTEXT}}` | Yes | File paths, URLs, or text for debate context |
| `{{GEMINI_CHAT_ID}}` | No | Existing chat_id. If absent, create a new chat. |
| `{{AGENT_STANCE}}` | No | "for" or "against". Randomly assigned if omitted. |
| `{{GEMINI_STANCE}}` | No | Opposite of `{{AGENT_STANCE}}` if omitted. Inferred from transcript if chat_id provided. |
| `{{TURN_LIMIT}}` | No | Max rounds. Default: 10. |

## Phase 1: Setup

### Flow A — New Chat (no chat_id)

1. Read `{{BG_CONTEXT}}` (files, URLs, text)
2. Build the seeding prompt with these parts:
   - Share context (≤2000 words)
   - Assign Gemini its stance
   - Set debate rules (technical claims only, acknowledge valid points, numbered arguments)
   - Request an opening argument
3. `gemiterm new "seeding prompt"` — creates a chat, sends the first message, writes the response to the console, and returns the chat_id (`c_XXXXXXXXXXXX`); read Gemini's opening response from the same console output

**Fallback:** If `gemiterm new` fails, ask the user to create a chat in the Gemini UI, paste the seeding prompt, and provide the chat_id. Then continue with Flow B.

### Flow B — Existing Chat (chat_id provided)

1. `gemiterm fetch {{GEMINI_CHAT_ID}} --format json`
2. Parse Gemini's position (last model message)
3. Read `{{BG_CONTEXT}}`
4. Build position map: what Gemini argues, evidence for/against

## Phase 2: Strategy & Execution

1. **Analyze** — identify opponent's main arguments, evidence, weaknesses
2. **Build opening argument** — address each opponent point, cite `{{BG_CONTEXT}}` evidence
3. **Spawn subagent** — see [REFERENCE.md](REFERENCE.md) for the prompt template

Fill template slots: `{{TOPIC}}`, `{{AGENT_STANCE}}`, `{{GEMINI_STANCE}}`, `{{GEMINI_CHAT_ID}}`, `{{TURN_LIMIT}}`, `{{BG_CONTEXT_SUMMARY}}`, `{{OPENING_ARGUMENT}}`.

The subagent runs autonomously. It returns a structured Debate Report (format in REFERENCE.md).

**Stopping criteria** (hardcoded in template):
- Turn limit reached
- Opponent concedes core question
- Opponent repeats same argument twice → declare convergence, summarize
- New factual information changes the calculus → stop, return to user

**No pre-planned counter-responses.** Debate proceeds in real-time.

## Edge Cases

| Situation | Action |
|-----------|--------|
| `gemiterm new` fails | User creates a chat in the Gemini UI, provides the chat_id |
| chat_id not in `gemiterm list` | Ask user to verify; may need a moment to appear |
| Gemini concedes turn 1-2 | Accept, produce short report, stop |
| New factual information | Stop, return to user with info + recommendation |
| Auth expired | Stop, user runs `gemiterm auth` |
| Rate limits | Wait 10s between turns; if persistent, stop and report |
