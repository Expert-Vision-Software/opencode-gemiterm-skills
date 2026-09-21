# Changelog

All notable changes to `opencode-gemiterm-skills` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Registration detection no longer keys off the launch directory. The self-checkout carve-out (`directory === packageDir` ⇒ repo-local) is gone: detection is config-based only — the global config dir, the repo's `.opencode/`, and a repo-root config — so a plugin never infers registration from where it happens to be launched.
- The `config` hook can no longer stall OpenCode startup: its entire body is wrapped in try/catch, and any failure (rotted plugin cache, unreadable package metadata, a blocked destination) degrades to a warn log plus a warning toast naming the exact remediation — never a rethrow. The hook never auto-deletes the cache, since that races OpenCode's in-flight installs; hard errors stay CLI-only.
- Consumer install snippets now use the correct OpenCode config key `plugin` (singular), not `plugins`. The config schema sets `additionalProperties: false`, so `plugins` is invalid.

### Added

- Format-tolerant registration detection: `opencode.jsonc` is honored alongside `opencode.json` in the global config dir, `<repo>/.opencode/`, and the repo root. `.jsonc` files are parsed leniently — string-aware stripping of `//` and `/* */` comments and trailing commas, so `$schema` URLs survive — while `.json` stays strict. Config writes still target `opencode.json`.
- Load-failure advisory (log + toast) with cache-rot remediation: when the `config` hook fails, the message names `bunx opencode-gemiterm-skills install --scope global` and the `~/.cache/opencode/packages/opencode-gemiterm-skills@<version>` directory to clear. The advisory builder itself is infallible, with a static fallback when package metadata is unreadable.

### Changed

- `@opencode-ai/plugin` is now classified as a `devDependency`: every import in the shipped code is type-only and fully erased at runtime, so the published package declares **no runtime dependencies**.

## [1.0.0] - 2026-09-17

### Changed

- **Scope-aware, manifest-gated load-time installation** (aligned with the `opencode-auto-qcgates` v1.5.0 model):
  - `plugin.ts` now performs read-only registration-scope detection (`src/registration.ts`): global config / repo `.opencode/opencode.json` / repo-root `opencode.json`, with semantic `@latest`-aware name matching. The old `directory`-based global-vs-local guess (which leaked local installs into every consumer repo) is gone.
  - Installs are gated by `<configBase>/opencode-gemiterm-skills.manifest.json` (version + per-file sha256 hashes, `src/manifest.ts`): up-to-date scope = zero-write no-op; version drift = update that scope only; consumer-modified files = skip + warn at load (`--force` stays CLI-only).
  - `.version` markers are obsolete; they are removed on the first manifest-era install and `status` falls back to them only for pre-manifest installs.
- Hardening carried into the CLI: unparseable opencode.json is never rewritten from `{}` (refuse + warn, preserved byte-for-byte); plugin entries are written canonically as `name@latest` with semantic dedup; root-config migration and `plugin`-array edits are consented CLI actions only — the load hook never performs them.
- New `install --force` CLI flag to overwrite consumer-modified installed files.
- `status` now reports both scopes independently.

### Added

- One-shot advisory (log + toast) when the package is registered in no scope and no install exists; fires exactly once per session and performs zero writes.
- Regression-contract test suite (`tests/regression.test.ts`) covering the full scope/manifest/`--force`/detection matrix with a sandboxed global config.

### Fixed

- Version drift with byte-identical files no longer stalls: the scope manifest is rewritten on drift even when no file content changed, so drift is reconciled in one load instead of recurring forever.
- `permission.skill` grants are now ensured on every manifest rewrite, not only when skill files are written.
- Registration detection warns (instead of silently reporting "not installed") when an opencode.json it inspects is not valid JSON.
- Advisory/toast helpers moved out of `plugin.ts` into `src/advisory.ts` per the repo's src-only rule.

---

## [0.7.0] - 2026-06-13

### Changed

- Aligned with GemiTerm update v2.2.0.

---

## [0.6.2] - 2026-06-12

### Fixed
- `install` no longer adds a duplicate plugin entry when `opencode-gemiterm-skills` is already present under a different form (e.g. `opencode-gemiterm-skills@latest` or different casing). Added a shared `normalizePluginName`/`isOurPluginEntry` helper that strips version tags (`@latest`, `@1.2.3`) and lowercases before matching, used by `addPluginToConfig`, `removePluginFromConfig`, and `isPluginInConfig`. Scoped packages (`@scope/pkg`) are handled correctly so the leading `@` isn't mistaken for a version separator.

### Added
- Exported `normalizePluginName` and `isOurPluginEntry` from `src/installer.ts` for direct unit testing.
- 6 new tests in `tests/skills.test.ts` covering version-spec stripping, case-insensitivity, whitespace trimming, scoped-package handling, and matching/rejecting the right entries.

## [0.6.1] - 2026-06-12

### Changed
- Fixed frontmatter for `debate-with-gemini` skill.

---

## [0.6.0] - 2026-06-10

### Changed
- **GemiTerm is now a Bun-native CLI** — the underlying `gemiterm` CLI has been rewritten to run on Bun instead of Python. All skill documents updated to reflect the new runtime: skills first check for a global `gemiterm` install, fall back to `bunx gemiterm` for transparent npx-style invocation, and if Bun itself is missing emit platform-aware install instructions (`curl -fsSL https://bun.sh/install | bash` on macOS/Linux, `powershell -c "irm bun.sh/install.ps1 | iex"` on Windows) before erroring out.
- Added `metadata.runtime: bun` to both skill frontmatter entries.
- Updated `debate-with-gemini` REFERENCE.md subagent template to mention `bunx gemiterm` fallback for every command and added `bunx gemiterm *` to the permissions block.
- **Rewrote both skill documents** — `gemiterm` and `debate-with-gemini` SKILL.md and REFERENCE.md now contain richer, more structured content: the `debate-with-gemini` skill includes tactical patterns (Concede-and-Counter, Force Concrete Example, Decision Matrix, Reframe the Question, Line-in-the-Sand), explicit stopping criteria, and a structured debate-report format; the `gemiterm` skill has an expanded command reference with detailed flags and common automation patterns.
- **Directory restructure** — moved `assets/skills/{gemiterm,debate-with-gemini}` → `skills/{gemiterm,debate-with-gemini}` so both skills sit at the standard `skills/<name>/SKILL.md` path recognized by Vercel's `skills` CLI (and the broader skills ecosystem).
- `.claude-plugin/plugin.json` and `.opencode/opencode.json` updated to reference the new `./skills` path; `package.json#files` now whitelists `skills` instead of `assets`.
- `src/installer.ts` and `tests/skills.test.ts` source-path constants updated accordingly.
- Docs (`AGENTS.md`, `CONTRIBUTING.md`) updated to reflect the new layout.

### Removed
- `assets/` directory (no longer needed; skills moved to repo root).
- All references to `pipx install gemiterm` and Python-based install paths.

---

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

---

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
