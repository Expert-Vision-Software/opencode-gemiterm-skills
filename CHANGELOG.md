# Changelog

All notable changes to `opencode-gemiterm-skills` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.2] - 2026-06-10

### Changed
- **Skill directory layout** — moved `assets/skills/{gemiterm,debate-with-gemini}` → `skills/{gemiterm,debate-with-gemini}` so both skills sit at the standard `skills/<name>/SKILL.md` path recognized by Vercel's `skills` CLI (and the broader skills ecosystem). Previously the package relied on the recursive fallback, which inconsistently surfaced only one of the two skills when listed with `npx skills <repo> --list`.
- `.claude-plugin/plugin.json` and `.opencode/opencode.json` updated to reference the new `./skills` path; `package.json#files` now whitelists `skills` instead of `assets`.
- `src/installer.ts` and `tests/skills.test.ts` source-path constants updated accordingly.
- Docs (`AGENTS.md`, `CONTRIBUTING.md`) updated to reflect the new layout.

### Removed
- `assets/` directory (no longer needed; skills moved to repo root).

## [0.5.1] - 2026-06-07

### Added
- `CONTRIBUTING.md` — developer-facing docs with architecture, file layout, coding rules, and troubleshooting (extracted from README)

### Changed
- **README rewrite** — refocused for end-users and SEO: HTML meta comment with keywords, centered hero header, streamlined examples with emoji headers, "Why this plugin?" value-proposition section, call-to-action footer
- README generalized to be agent-agnostic: describes "any AI agent" instead of only OpenCode-specific framing; shows both `bunx` and `npx` install commands; "CLI install (any agent)" as the primary install method
- `debate-with-gemini` skill frontmatter: removed `metadata.requires` field; added `compatibility` and `license` fields
- `gemiterm` skill frontmatter: added `compatibility` and `license` fields

### Removed
- Test for `metadata.requires: gemiterm` on `debate-with-gemini` (field no longer exists)

## [0.5.0] - 2026-06-07

_Initial public release._

### Added
- npm distribution support: `bin` field exposes `opencode-gemiterm-skills` CLI via `bunx` / `npx` (`install`, `uninstall`, `status` subcommands)
- `engines: { "bun": ">=1.0.0" }` and `sideEffects: false` metadata in `package.json`
- `homepage` and `author` fields in `package.json`
- `prepublishOnly` script that runs `tsc --noEmit` and `bun test` before publish
- Bun shebang (`#!/usr/bin/env bun`) on `index.ts` so the CLI stub is executable
- README: **Example use cases** section demonstrating both `gemiterm` and `debate-with-gemini` skills with sample prompts and agent responses
- README: introduction blurb linking to the [`gemiterm` CLI repository](https://github.com/Expert-Vision-Software/gemiterm)
- README: `gemiterm` CLI link in the Requirements table

### Changed
- `package.json` `files` array whitelists `.opencode/opencode.json` instead of the entire `.opencode/` directory, preventing dev-only artifacts from shipping
- `.opencode/opencode.json` (self-config) stripped of dev-only entries (extra skills path, plugin array, empty MCP block)
- Module/CLI refactor: `index.ts` is a one-line re-export of `plugin.ts`; CLI entry moved to `src/cli.ts` with dynamic version read from `package.json`; `package.json#bin` points at `./src/cli.ts`; `package.json#files` includes `"src"`; `tsconfig.json#include` includes `"src/**/*.ts"`
- `package.json` version bumped to `0.5.0`

## [0.1.0] - 2026-06-06

### Added
- Initial bundle of the `gemiterm` skill (SKILL.md + REFERENCE.md)
- Initial bundle of the `debate-with-gemini` skill (SKILL.md + REFERENCE.md)
- Self-config at `.opencode/opencode.json` registering `assets/skills/` as a skill path
- Pre-configured `permission.skill` entries for both bundled skills
- `opencode.plugin` pointer in `package.json` to `.opencode/opencode.json`
- Minimal `plugin.ts` and `index.ts` stubs (markdown-only, no TypeScript logic)
- Smoke test suite at `tests/skills.test.ts` validating frontmatter and self-config
