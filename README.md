# opencode-gemiterm-skills

[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-blue?link=https://opencode.ai)](https://opencode.ai)
[![npm version](https://img.shields.io/npm/v/opencode-gemiterm-skills?label=npm)](https://www.npmjs.com/package/opencode-gemiterm-skills)
[![MIT License](https://img.shields.io/badge/License-MIT-green?link=LICENSE)](LICENSE)

Local OpenCode plugin package that bundles the `gemiterm` and `debate-with-gemini` skills for OpenCode agents. Install once and the skills are available to every OpenCode session on the machine.

## Bundled skills

| Skill | Purpose |
|-------|---------|
| `gemiterm` | Google Gemini Terminal CLI wrapper for listing, fetching, exporting, and managing Gemini chat history. |
| `debate-with-gemini` | Conducts structured multi-turn technical debates with Gemini AI via the `gemiterm` CLI, delegating the back-and-forth to a subagent. |

Both skills are loaded on demand via the native `skill` tool. The metadata of each skill (name + description) is pre-loaded at session start; the full `SKILL.md` body is loaded only when the agent decides the skill is relevant.

## Quick start

```bash
# Install skills and register them with OpenCode
bunx opencode-gemiterm-skills install

# Or globally (for all projects on this machine)
bunx opencode-gemiterm-skills install --scope global
```

That's it. After install, both `gemiterm` and `debate-with-gemini` appear in the `skill` tool's `<available_skills>` list. No restart needed — OpenCode loads skills on demand.

For global install, skills are placed in `~/.config/opencode/skills/`. For local install (default), they are placed in `{project}/.opencode/skills/`.

## Requirements

| | Component | Notes |
| --- | --- | --- |
| **Runtime** | `gemiterm` Python CLI | Must be installed and authenticated. Both bundled skills depend on it. |
| **Optional** | Bun `>=1.0.0` | Required only for the CLI installer (`bunx opencode-gemiterm-skills install`) and the test suite (`bun test`). |

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Skill not in `<available_skills>` list | Not installed yet | Run `bunx opencode-gemiterm-skills install` (or `--scope global`) |
| Skill not in `<available_skills>` list after install | `gemiterm` auth expired or incomplete | Run `gemiterm status` and re-authenticate if needed |
| `bunx opencode-gemiterm-skills` not found | Bun `<1.0.0` or package not in PATH | Ensure Bun `>=1.0.0` is installed; try `npx opencode-gemiterm-skills` as fallback |

## Install (file:// reference)

For local development against a checkout of this repo, reference the package directory directly from the consumer's `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "file:///absolute/path/to/opencode-gemiterm-skills"
  ]
}
```

This skips the npm install. OpenCode will auto-install skills from the local checkout on first load.

## File layout

```
opencode-gemiterm-skills/
├── .opencode/
│   └── opencode.json              # self-config: skills.paths + permission.skill
├── assets/
│   └── skills/
│       ├── gemiterm/
│       │   ├── SKILL.md
│       │   └── REFERENCE.md
│       └── debate-with-gemini/
│           ├── SKILL.md
│           └── REFERENCE.md
├── src/
│   ├── cli.ts                     # CLI entry: install / uninstall / status
│   ├── commands/
│   │   ├── install.ts
│   │   ├── uninstall.ts
│   │   └── status.ts
│   └── installer.ts               # core install logic
├── tests/
│   └── skills.test.ts             # smoke test
├── .gitignore
├── AGENTS.md
├── CHANGELOG.md
├── LICENSE
├── README.md
├── index.ts                       # module entry: re-exports plugin.ts
├── package.json
├── plugin.ts                      # plugin entry with config hook (auto-install on load)
└── tsconfig.json
```

## How it works

### Install command

`bunx opencode-gemiterm-skills install` copies skill files to the target `skills/` directory and registers the package in `opencode.json`:

- **Local** (default): copies to `{project}/.opencode/skills/{gemiterm,debate-with-gemini}/` and updates `{project}/.opencode/opencode.json`
- **Global**: copies to `~/.config/opencode/skills/{gemiterm,debate-with-gemini}/` and updates `~/.config/opencode/opencode.json`

It also pre-grants `permission.skill: "allow"` for both skills and writes a `.version` marker to skip re-install on subsequent loads.

### Plugin auto-install

When OpenCode loads the package via `opencode.json` plugins array, `plugin.ts` runs the same install logic with a version-marker check — so the package auto-installs skills on first use if not already installed.

### CLI commands

| Command | Description |
| --- | --- |
| `bunx opencode-gemiterm-skills install` | Install skills locally (or `--scope global`) |
| `bunx opencode-gemiterm-skills uninstall` | Remove installed skills |
| `bunx opencode-gemiterm-skills status` | Check install status and version |

`index.ts` is the module entry, a one-line re-export of `plugin.ts`.

## Development

Run the test suite:

```bash
bun test
```

The smoke test verifies:

- Both `assets/skills/*/SKILL.md` files exist and parse as valid YAML frontmatter.
- `name` matches the directory name.
- `description` is non-empty and within the 1024-character limit.
- The `metadata.requires: gemiterm` link on `debate-with-gemini` is preserved.
- The `metadata.tool: gemiterm` link on `gemiterm` is preserved.
- `.opencode/opencode.json` exists and registers at least one skill path.
- `package.json` points `opencode.plugin` at `.opencode/opencode.json`.

## Notes for consumers

- The `metadata.requires: gemiterm` field is preserved verbatim on `debate-with-gemini`. OpenCode does not enforce skill-to-skill dependencies — the agent must check `metadata.requires` and the prerequisites above before invoking `debate-with-gemini`.
- The `metadata.tool`, `metadata.requires`, and `metadata.workflow` fields are stored under the `metadata` map (which OpenCode recognises). Sub-keys beyond `metadata` itself are not formally specified in the OpenCode skill schema, so they may be ignored by some agents — this package treats them as documentation only.
- The CLI is exposed as `opencode-gemiterm-skills` via the `bin` field, implemented in `src/cli.ts`. Run it with `bunx opencode-gemiterm-skills` or `npx opencode-gemiterm-skills`.

## Acknowledgments

- [OpenCode](https://opencode.ai) — plugin architecture and skill loader
- [Bun](https://bun.sh) — fast JS runtime used as the package's CLI host
- [DeepWiki](https://deepwiki.com) — research and context tool for codebase exploration

## Publishing

This package is published to npm as `opencode-gemiterm-skills`. To cut a new release:

```bash
npm version patch   # or minor / major
npm publish --access public
```

The `prepublishOnly` script runs `tsc --noEmit` and `bun test` before publishing.

## License

MIT. See [LICENSE](LICENSE).
