# Contributing to opencode-gemiterm-skills

Thanks for your interest in contributing! This guide covers the technical internals, development setup, and architecture.

## Development setup

### Prerequisites

- [Bun](https://bun.sh) `>=1.0.0` — required for the CLI installer, test suite, and the gemiterm CLI
- [gemiterm](https://github.com/Expert-Vision-Software/gemiterm) CLI — a Bun-native app; install with `bun install gemiterm -g`, then `gemiterm install-browser && gemiterm auth`

### Install dependencies

```bash
bun install
```

### Run the test suite

```bash
bun test
```

The smoke test (`tests/skills.test.ts`) verifies:

- Both `skills/*/SKILL.md` files exist and parse as valid YAML frontmatter.
- `name` matches the directory name.
- `description` is non-empty and within the 1024-character limit.
- The `metadata.requires: gemiterm` link on `debate-with-gemini` is preserved.
- The `metadata.tool: gemiterm` link on `gemiterm` is preserved.
- `.opencode/opencode.json` exists and registers at least one skill path.
- `package.json` points `opencode.plugin` at `.opencode/opencode.json`.

## File layout

```
opencode-gemiterm-skills/
├── .opencode/
│   └── opencode.json              # self-config: skills.paths + permission.skill
├── skills/
│   ├── gemiterm/
│   │   ├── SKILL.md
│   │   └── REFERENCE.md
│   └── debate-with-gemini/
│       ├── SKILL.md
│       └── REFERENCE.md
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
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── index.ts                       # module entry: re-exports plugin.ts
├── package.json
├── plugin.ts                      # plugin entry with config hook (auto-install on load)
└── tsconfig.json
```

## Architecture

### Install command

`bunx opencode-gemiterm-skills install` copies skill files to the target `skills/` directory and registers the package in `opencode.json`:

- **Local** (default): copies to `{project}/.opencode/skills/{gemiterm,debate-with-gemini}/` and updates `{project}/.opencode/opencode.json`
- **Global**: copies to `~/.config/opencode/skills/{gemiterm,debate-with-gemini}/` and updates `~/.config/opencode/opencode.json`

It also pre-grants `permission.skill: "allow"` for both skills and writes a `.version` marker to skip re-install on subsequent loads.

### Plugin auto-install

When OpenCode loads the package via `opencode.json` plugins array, `plugin.ts` runs the same (local) install logic with a version-marker check — so the package auto-installs skills on first use if not already installed.

### CLI commands

| Command | Description |
| --- | --- |
| `bunx opencode-gemiterm-skills install` | Install skills locally (or `--scope global`) |
| `bunx opencode-gemiterm-skills uninstall` | Remove installed skills |
| `bunx opencode-gemiterm-skills status` | Check install status and version |

`index.ts` is the module entry, a one-line re-export of `plugin.ts`.

### Install via file:// reference

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

## Skill metadata conventions

- The `metadata.requires: gemiterm` field is preserved verbatim on `debate-with-gemini`. OpenCode does not enforce skill-to-skill dependencies — the agent must check `metadata.requires` and the prerequisites before invoking `debate-with-gemini`.
- The `metadata.tool`, `metadata.requires`, and `metadata.workflow` fields are stored under the `metadata` map (which OpenCode recognises). Sub-keys beyond `metadata` itself are not formally specified in the OpenCode skill schema, so they may be ignored by some agents — this package treats them as documentation only.
- The CLI is exposed as `opencode-gemiterm-skills` via the `bin` field, implemented in `src/cli.ts`. Run it with `bunx opencode-gemiterm-skills` or `npx opencode-gemiterm-skills`.

## Coding rules

1. **Skill frontmatter is the source of truth.** Do not edit `skills/*/SKILL.md` frontmatter in ways that break the `name` / `description` contract.
2. **The `metadata.requires: gemiterm` link** on `debate-with-gemini` must remain — consumers depend on it.
3. **GemiTerm is a Bun-native CLI.** All skill documents assume Bun as the runtime. Do not reference Python, `pipx`, or `pip` install paths.
4. **Only add code under `src/`** that supports the install/uninstall/status commands. This is a skill-bundling package, not a runtime library.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Skill not in `<available_skills>` list | Not installed yet | Run `bunx opencode-gemiterm-skills install` (or `--scope global`) |
| Skill not in `<available_skills>` list after install | `gemiterm` auth expired or incomplete | Run `gemiterm status` and re-authenticate if needed |
| `bunx opencode-gemiterm-skills` not found | Bun `<1.0.0` or package not in PATH | Ensure Bun `>=1.0.0` is installed; try `npx opencode-gemiterm-skills` as fallback |
