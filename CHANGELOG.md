# Changelog

All notable changes to `opencode-gemiterm-skills` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-06

### Added
- Initial bundle of the `gemiterm` skill (SKILL.md + REFERENCE.md)
- Initial bundle of the `debate-with-gemini` skill (SKILL.md + REFERENCE.md)
- Self-config at `.opencode/opencode.json` registering `assets/skills/` as a skill path
- Pre-configured `permission.skill` entries for both bundled skills
- `opencode.plugin` pointer in `package.json` to `.opencode/opencode.json`
- Minimal `plugin.ts` and `index.ts` stubs (markdown-only, no TypeScript logic)
- Smoke test suite at `tests/skills.test.ts` validating frontmatter and self-config
