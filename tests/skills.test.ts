import { test, expect, describe } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PACKAGE_ROOT = join(import.meta.dir, "..");
const SKILL_NAMES = ["gemiterm", "debate-with-gemini"] as const;
const DESCRIPTION_MAX = 1024;

async function loadSkillFile(skillName: string, fileName: string): Promise<string> {
  const path = join(PACKAGE_ROOT, "skills", skillName, fileName);
  return await readFile(path, "utf-8");
}

function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

function readFrontmatterField(frontmatter: string, field: string): string | null {
  const pattern = new RegExp(`^${field}:\\s*(.+)$`, "m");
  const match = frontmatter.match(pattern);
  return match ? match[1].trim() : null;
}

describe("bundled skills", () => {
  for (const name of SKILL_NAMES) {
    test(`${name}/SKILL.md exists and has valid frontmatter`, async () => {
      const content = await loadSkillFile(name, "SKILL.md");
      const frontmatter = extractFrontmatter(content);
      expect(frontmatter).not.toBeNull();
      if (frontmatter === null) return;

      const skillName = readFrontmatterField(frontmatter, "name");
      expect(skillName).toBe(name);

      const description = readFrontmatterField(frontmatter, "description");
      expect(description).not.toBeNull();
      if (description === null) return;
      expect(description.length).toBeGreaterThan(0);
      expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    });

    test(`${name}/REFERENCE.md exists and is non-empty`, async () => {
      const content = await loadSkillFile(name, "REFERENCE.md");
      expect(content.length).toBeGreaterThan(0);
    });
  }
});

test("gemiterm declares metadata.tool: gemiterm", async () => {
  const content = await loadSkillFile("gemiterm", "SKILL.md");
  const frontmatter = extractFrontmatter(content);
  expect(frontmatter).not.toBeNull();
  if (frontmatter === null) return;
  expect(frontmatter).toMatch(/^metadata:\s*$/m);
  expect(frontmatter).toMatch(/^\s+tool:\s+gemiterm\s*$/m);
});

describe("package self-config", () => {
  test(".opencode/opencode.json exists and registers skill paths", async () => {
    const path = join(PACKAGE_ROOT, ".opencode", "opencode.json");
    const content = await readFile(path, "utf-8");
    const config = JSON.parse(content) as Record<string, unknown>;
    const skills = config.skills as { paths?: unknown } | undefined;
    expect(skills).toBeDefined();
    expect(Array.isArray(skills?.paths)).toBe(true);
    if (!Array.isArray(skills?.paths)) return;
    expect(skills.paths.length).toBeGreaterThan(0);
  });

  test("package.json has no static opencode.plugin (plugin uses config hook instead)", async () => {
    const path = join(PACKAGE_ROOT, "package.json");
    const content = await readFile(path, "utf-8");
    const pkg = JSON.parse(content) as Record<string, unknown>;
    expect(pkg.name).toBe("opencode-gemiterm-skills");
    // No static opencode.plugin — plugin installs skills via config hook at runtime
    expect(pkg.opencode).toBeUndefined();
  });
});

describe("plugin entry normalization", () => {
  const { normalizePluginName, isOurPluginEntry } =
    require(join(PACKAGE_ROOT, "src", "installer.ts")) as typeof import("../src/installer");

  test("strips @latest and other version specs", () => {
    expect(normalizePluginName("opencode-gemiterm-skills@latest")).toBe(
      "opencode-gemiterm-skills",
    );
    expect(normalizePluginName("opencode-gemiterm-skills@1.2.3")).toBe(
      "opencode-gemiterm-skills",
    );
    expect(normalizePluginName("opencode-gemiterm-skills")).toBe(
      "opencode-gemiterm-skills",
    );
  });

  test("is case-insensitive", () => {
    expect(normalizePluginName("Opencode-Gemiterm-Skills")).toBe(
      "opencode-gemiterm-skills",
    );
    expect(normalizePluginName("OPENCODE-GEMITERM-SKILLS")).toBe(
      "opencode-gemiterm-skills",
    );
  });

  test("trims surrounding whitespace", () => {
    expect(normalizePluginName("  opencode-gemiterm-skills  ")).toBe(
      "opencode-gemiterm-skills",
    );
  });

  test("does not treat scoped package leading @ as a version", () => {
    expect(normalizePluginName("@scope/pkg@1.0.0")).toBe("@scope/pkg");
    expect(normalizePluginName("@scope/pkg")).toBe("@scope/pkg");
  });

  test("isOurPluginEntry matches variants of our package", () => {
    expect(isOurPluginEntry("opencode-gemiterm-skills")).toBe(true);
    expect(isOurPluginEntry("opencode-gemiterm-skills@latest")).toBe(true);
    expect(isOurPluginEntry("Opencode-Gemiterm-Skills@2.0.0")).toBe(true);
  });

  test("isOurPluginEntry rejects unrelated packages", () => {
    expect(isOurPluginEntry("opencode-architect")).toBe(false);
    expect(isOurPluginEntry("some-other-pkg@latest")).toBe(false);
    expect(isOurPluginEntry("@scope/opencode-gemiterm-skills")).toBe(false);
  });
});
