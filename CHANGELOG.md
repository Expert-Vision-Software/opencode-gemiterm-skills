# Changelog

All notable changes to `opencode-gemiterm-skills` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-06

### Added
- npm distribution support: `bin` field exposes `opencode-gemiterm-skills` CLI stub via `bunx` / `npx`
- `engines: { "bun": ">=1.0.0" }` and `sideEffects: false` metadata
- `homepage` and `author` fields in `package.json`
- `prepublishOnly` script that runs `tsc --noEmit` and `bun test` before publish
- Bun shebang (`#!/usr/bin/env bun`) on `index.ts` so the CLI stub is executable
- README section for `npm install` install path (file:// install preserved as alternative)
- README section documenting the publish flow

### Changed
- `package.json` `files` array now whitelists `.opencode/opencode.json` instead of the entire `.opencode/` directory, so the dev-only `node_modules`, `package.json`, and lockfile in `.opencode/` do not ship
- `.opencode/opencode.json` (self-config) stripped of dev-only entries: removed `../.agents/skills` from `skills.paths`, removed the `plugin: ["opencode-architect"]` array, removed the empty `mcp: {}` block
- `package.json` version bumped to `0.2.0`
- Module/CLI refactor: `index.ts` is now a one-line re-export of `plugin.ts`; the CLI stub (version/help) moved to `src/cli.ts` with a `#!/usr/bin/env bun` shebang and dynamic version read from `package.json`. `package.json#bin` now points at `./src/cli.ts`; `package.json#files` now includes `"src"`; `tsconfig.json#include` now includes `"src/**/*.ts"`. This eliminates the hardcoded version string and matches the layout used by `opencode-intellisearch`.

## [0.1.0] - 2026-06-06

### Added
- Initial bundle of the `gemiterm` skill (SKILL.md + REFERENCE.md)
- Initial bundle of the `debate-with-gemini` skill (SKILL.md + REFERENCE.md)
- Self-config at `.opencode/opencode.json` registering `assets/skills/` as a skill path
- Pre-configured `permission.skill` entries for both bundled skills
- `opencode.plugin` pointer in `package.json` to `.opencode/opencode.json`
- Minimal `plugin.ts` and `index.ts` stubs (markdown-only, no TypeScript logic)
- Smoke test suite at `tests/skills.test.ts` validating frontmatter and self-config
