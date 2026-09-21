# AGENTS.md - opencode-gemiterm-skills

<critical_rules priority="highest">
1. The bundled `debate-with-gemini` skill depends on the `gemiterm` Bun-native CLI being installed (or available via `bunx gemiterm`) and authenticated on the host.
2. This package ships a real installer (`src/installer.ts`) that copies skill assets to the consumer's `.opencode/skills/` and registers them in `opencode.json`. The `src/cli.ts` is the CLI entry point (install/uninstall/status subcommands), resolved by `package.json#bin`. Only add code under `src/` that supports the install/uninstall/status commands.
3. Skill frontmatter is the source of truth. Do not edit `skills/*/SKILL.md` frontmatter in ways that break the `name` / `description` contract.
4. The `metadata.requires: gemiterm` link on `debate-with-gemini` must remain so consumers know to install the CLI first.
5. GemiTerm is a Bun-native CLI — all skill documents assume Bun as the runtime. Do not reference Python, `pipx`, or `pip` install paths.
</critical_rules>

<context_hierarchy>
<system>OpenCode plugin loader</system>
<domain>OpenCode skill packaging</domain>
<task>Bundle markdown skills into a publishable plugin package</task>
<execution>npm distribution (opencode-gemiterm-skills) with file:// reference as a development fallback</execution>
</context_hierarchy>

<role>
<identity>opencode-gemiterm-skills package maintainer</identity>
<scope>This repository only</scope>
<constraints>Markdown-only bundle, no build step, zero runtime dependencies — `@opencode-ai/plugin` is type-only (every import is erased at runtime), so it lives in devDependencies</constraints>
</role>

<bundled_skills>
<skill name="gemiterm" path="skills/gemiterm/SKILL.md" requires="Bun-native CLI gemiterm" />
<skill name="debate-with-gemini" path="skills/debate-with-gemini/SKILL.md" requires="gemiterm skill + Bun-native CLI gemiterm" />
</bundled_skills>

<conventions>
- **Peer parity: hooks never throw, and registration detection is config-based and format-tolerant.** The `config` hook (`plugin.ts`) wraps its body in try/catch: any failure degrades to a warn log + toast naming the exact remediation (`bunx opencode-gemiterm-skills install --scope global`, plus the `~/.cache/opencode/packages/opencode-gemiterm-skills@<version>` dir to clear for cache rot). It never rethrows, never auto-deletes the cache (that races OpenCode's in-flight installs), and hard errors stay CLI-only. Registration detection (`src/installer.ts`, `isPluginInConfigBase`) honors both `opencode.json` and `opencode.jsonc` in the global config dir, `.opencode/`, and the repo root — `.jsonc` is parsed leniently, `.json` stays strict — and detection never keys off the launch directory.
</conventions>

<self_config>
<location>.opencode/opencode.json</location>
<purpose>Register skills/ as a skill path and pre-allow both skills</purpose>
<registration>No package.json opencode key (tests/skills.test.ts asserts pkg.opencode is undefined). Dev use is covered by skills.paths: ["../skills"]; this file does NOT self-register the package in its plugin array, so detection stays "none" for the maintainer checkout.</registration>
</self_config>

<consumer_install>
<npm>
<command>npm install opencode-gemiterm-skills</command>
<opencode_json_snippet>
{
  "plugin": [
    "opencode-gemiterm-skills@latest"
  ]
}
</opencode_json_snippet>
</npm>
<file_fallback>
<opencode_json_snippet>
{
  "plugin": [
    "file:///ABSOLUTE/PATH/TO/opencode-gemiterm-skills"
  ]
}
</opencode_json_snippet>
<use_case>Local development against a checkout of this repo</use_case>
</file_fallback>
<prerequisites>
  - bun install gemiterm -g
  - gemiterm install-browser
  - gemiterm auth
</prerequisites>
</consumer_install>

<testing>
<runner>bun test</runner>
<file>tests/skills.test.ts</file>
<coverage>Frontmatter validation, skill-path self-config, package.json pointer, cross-skill dependency link</coverage>
</testing>
