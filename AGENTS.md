# AGENTS.md - opencode-gemiterm-skills

<critical_rules priority="highest">
1. The bundled `debate-with-gemini` skill depends on the `gemiterm` Python CLI being installed and authenticated on the host.
2. This package is markdown-only — it has no TypeScript logic and no CLI installer. The `src/` folder exists solely to host the CLI stub at `src/cli.ts` (version/help printer, resolved by `package.json#bin`). Do not add any other code under `src/`.
3. Skill frontmatter is the source of truth. Do not edit `assets/skills/*/SKILL.md` frontmatter in ways that break the `name` / `description` contract.
4. The `metadata.requires: gemiterm` link on `debate-with-gemini` must remain so consumers know to install the Python CLI first.
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
<constraints>Markdown-only bundle, no build step, no runtime dependencies</constraints>
</role>

<bundled_skills>
<skill name="gemiterm" path="assets/skills/gemiterm/SKILL.md" requires="Python CLI gemiterm" />
<skill name="debate-with-gemini" path="assets/skills/debate-with-gemini/SKILL.md" requires="gemiterm skill + Python CLI gemiterm" />
</bundled_skills>

<self_config>
<location>.opencode/opencode.json</location>
<purpose>Register assets/skills/ as a skill path and pre-allow both skills</purpose>
<pointer_in_package_json>opencode.plugin → .opencode/opencode.json</pointer_in_package_json>
</self_config>

<consumer_install>
<npm>
<command>npm install opencode-gemiterm-skills</command>
<opencode_json_snippet>
{
  "plugins": [
    "opencode-gemiterm-skills"
  ]
}
</opencode_json_snippet>
</npm>
<file_fallback>
<opencode_json_snippet>
{
  "plugins": [
    "file:///ABSOLUTE/PATH/TO/opencode-gemiterm-skills"
  ]
}
</opencode_json_snippet>
<use_case>Local development against a checkout of this repo</use_case>
</file_fallback>
<prerequisites>
  - pip install gemiterm
  - gemiterm install-browser
  - gemiterm auth
</prerequisites>
</consumer_install>

<testing>
<runner>bun test</runner>
<file>tests/skills.test.ts</file>
<coverage>Frontmatter validation, skill-path self-config, package.json pointer, cross-skill dependency link</coverage>
</testing>
