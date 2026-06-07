<!-- 
  SEO description: opencode-gemiterm-skills is an OpenCode plugin that adds Google Gemini terminal skills 
  to your AI agent — list, search, export Gemini chats and run structured debates with Gemini from OpenCode.
  Keywords: OpenCode plugin, Gemini CLI, gemiterm, AI agent skills, Google Gemini terminal, 
  OpenCode skills, Gemini chat export, AI debate, multi-turn debate, terminal AI
-->

<div align="center">

# opencode-gemiterm-skills

**OpenCode skills for Google Gemini — chat export, search & AI-powered debates from your terminal**

[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-blue?link=https://opencode.ai)](https://opencode.ai)
[![npm version](https://img.shields.io/npm/v/opencode-gemiterm-skills?label=npm)](https://www.npmjs.com/package/opencode-gemiterm-skills)
[![MIT License](https://img.shields.io/badge/License-MIT-green?link=LICENSE)](LICENSE)

[Quick Start](#quick-start) · [Skills](#bundled-skills) · [Examples](#examples) · [Requirements](#requirements) · [Contributing](CONTRIBUTING.md)

</div>

---

Bring the power of [Google Gemini](https://gemini.google.com) directly into your [OpenCode](https://opencode.ai) agent sessions. This plugin bundles two skills — **gemiterm** and **debate-with-gemini** — so your AI coding assistant can search your Gemini chats, export conversation history, and even run structured multi-turn debates with Gemini to validate ideas before you commit to code.

## Bundled skills

| Skill | What it does |
|-------|-------------|
| **gemiterm** | Search, list, export, and manage your Google Gemini chat history from the terminal. |
| **debate-with-gemini** | Run structured multi-turn technical debates with Gemini AI — perfect for validating architecture decisions, trade-offs, and design choices. |

Both skills are loaded on demand via the native `skill` tool. Metadata (name + description) is pre-loaded at session start; the full skill body loads only when the agent decides it's relevant — zero overhead when not in use.

## Quick start

```bash
# Install skills and register them with OpenCode
bunx opencode-gemiterm-skills install

# Or globally (all projects on this machine)
bunx opencode-gemiterm-skills install --scope global
```

That's it — both skills appear in OpenCode's `<available_skills>` list immediately. No restart needed.

## Examples

### 🔍 Search and export Gemini chats

> **You:** "Find my Gemini chats about React Server Components and export them."

Agent loads the `gemiterm` skill, searches your Gemini history, and exports matches:

```
Found 3 matching chats. Exported all to ./exports/ — here's a summary of each…
```

### 📦 Bulk export for offline analysis

> **You:** "Export all my recent Gemini chats so I can grep through them."

Agent lists and exports chats in parallel:

```
Exported 18 chats to ./gemini-exports/ in Markdown. Search with: grep -r "topic" ./gemini-exports/
```

### 🗣️ Structured debate with Gemini

> **You:** "Debate Gemini for/against using SQLite as the primary database for a SaaS app. Context: docs/arch.md. 5 turns."

Agent reads your context, seeds a new Gemini chat with the opposing stance, and runs 5 rounds of autonomous back-and-forth:

```
Debate complete (5 turns). Gemini argued FOR SQLite (simplicity, zero-config).
I argued AGAINST (concurrency limits, no network access, scaling ceiling).
Key agreements: fine for prototyping, migrate to Postgres before 100+ concurrent users.
```

### 🔄 Continue a previous debate

> **You:** "Continue that SQLite debate for 3 more turns. Here's the chat_id: c_abc123."

Agent picks up exactly where the last round left off:

```
Resumed debate on chat c_abc123. Ran 3 additional turns.
Gemini conceded on the replication point but raised WAL-mode mitigations.
```

## Requirements

| Component | Notes |
|-----------|-------|
| **[gemiterm](https://github.com/Expert-Vision-Software/gemiterm) CLI** | Must be installed and authenticated. Both skills depend on it. |
| **Bun `>=1.0.0`** *(optional)* | Required only for the CLI installer (`bunx … install`) and test suite. |

## Installation

### From npm

```bash
npm install opencode-gemiterm-skills
```

Then add to your `opencode.json`:

```json
{
  "plugins": ["opencode-gemiterm-skills"]
}
```

### Local development

Reference the package directory directly:

```json
{
  "plugins": ["file:///absolute/path/to/opencode-gemiterm-skills"]
}
```

OpenCode auto-installs skills from the local checkout on first load.

## Why this plugin?

- **No context switching** — access your Gemini conversations without leaving OpenCode.
- **Zero-config debates** — let your agent argue both sides of a technical decision with real Gemini responses.
- **Portable chat data** — export Gemini history to Markdown for grep, archival, or feeding into other tools.
- **Lightweight** — pure skill bundle, no runtime dependencies, loads on demand.

## Acknowledgments

- [OpenCode](https://opencode.ai) — plugin architecture and skill loader
- [gemiterm](https://github.com/Expert-Vision-Software/gemiterm) — underlying Gemini CLI

---

<div align="center">

**[📦 Install from npm](https://www.npmjs.com/package/opencode-gemiterm-skills)** · **[🤝 Contribute](CONTRIBUTING.md)** · **[📄 License](LICENSE)**

</div>
