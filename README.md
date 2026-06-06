# opencode-gemiterm-skills

Local OpenCode plugin package that bundles the `gemiterm` and `debate-with-gemini` skills so other projects can install both by adding a single entry to their `opencode.json` `plugins` array.

This package is **markdown-only**. It contains no TypeScript logic, no CLI installer, and no `src/` folder. The skill assets in `assets/skills/` are registered with OpenCode via the package's self-config at `.opencode/opencode.json`, which is wired up through the `opencode.plugin` pointer in `package.json`.

## Bundled skills

| Skill | Purpose |
|-------|---------|
| `gemiterm` | Google Gemini Terminal CLI wrapper for listing, fetching, exporting, and managing Gemini chat history. |
| `debate-with-gemini` | Conducts structured multi-turn technical debates with Gemini AI via the `gemiterm` CLI, delegating the back-and-forth to a subagent. |

Both skills are loaded on demand via the native `skill` tool. The metadata of each skill (name + description) is pre-loaded at session start; the full `SKILL.md` body is loaded only when the agent decides the skill is relevant.

## Prerequisites

The `gemiterm` Python CLI must be installed and authenticated on the consumer's machine. `debate-with-gemini` depends on it.

```bash
pip install gemiterm
gemiterm install-browser
gemiterm auth
```

Verify before use:

```bash
gemiterm --version
gemiterm status
```

The `install-browser` step is a one-time Playwright install (Chrome by default). The `auth` step opens a browser for the OAuth flow and must be run interactively.

## Install (npm)

```bash
npm install opencode-gemiterm-skills
```

Then add the package name to your `opencode.json` `plugins` array:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "opencode-gemiterm-skills"
  ]
}
```

OpenCode loads the package, applies the self-config at `.opencode/opencode.json`, and registers `assets/skills/` as a skill path. After restarting OpenCode, both skills should appear in the `skill` tool's `<available_skills>` list.

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

Replace the path with the absolute location of the package on your machine.

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
│   └── cli.ts                     # CLI stub (version / help), exposed via bin
├── tests/
│   └── skills.test.ts             # smoke test
├── .gitignore
├── AGENTS.md
├── CHANGELOG.md
├── LICENSE
├── README.md
├── index.ts                       # module entry: re-exports plugin.ts
├── package.json
├── plugin.ts                      # no-op plugin entry
└── tsconfig.json
```

## How it works

- `package.json` declares `"opencode": { "plugin": ".opencode/opencode.json" }`.
- When the consumer adds the package to their `plugins` array, OpenCode loads it and applies the self-config.
- `.opencode/opencode.json` sets `skills.paths` to `../assets/skills` (relative to the config file's location) and pre-grants `permission.skill: "allow"` for both skills.
- `plugin.ts` is a no-op because the self-config handles all the work.
- `index.ts` is the module entry, a one-line re-export of `plugin.ts`. The actual CLI lives in `src/cli.ts` and is what `bunx opencode-gemiterm-skills` invokes.

## Tests

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
- A CLI stub is exposed as `opencode-gemiterm-skills` via the `bin` field, implemented in `src/cli.ts`. It prints the package version (read live from `package.json`) and a help summary; it does not perform any installation. Run it with `bunx opencode-gemiterm-skills` or `npx opencode-gemiterm-skills`.

## Publishing

This package is published to npm as `opencode-gemiterm-skills`. To cut a new release:

```bash
npm version patch   # or minor / major
npm publish --access public
```

The `prepublishOnly` script runs `tsc --noEmit` and `bun test` before publishing.

## License

MIT. See [LICENSE](LICENSE).
