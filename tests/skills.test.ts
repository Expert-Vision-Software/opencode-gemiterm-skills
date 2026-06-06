import { test, expect, describe } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PACKAGE_ROOT = join(import.meta.dir, "..");
const SKILL_NAMES = ["gemiterm", "debate-with-gemini"] as const;
const DESCRIPTION_MAX = 1024;

async function loadSkillFile(skillName: string, fileName: string): Promise<string> {
  const path = join(PACKAGE_ROOT, "assets", "skills", skillName, fileName);
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

test("debate-with-gemini declares metadata.requires: gemiterm", async () => {
  const content = await loadSkillFile("debate-with-gemini", "SKILL.md");
  const frontmatter = extractFrontmatter(content);
  expect(frontmatter).not.toBeNull();
  if (frontmatter === null) return;
  expect(frontmatter).toMatch(/^metadata:\s*$/m);
  expect(frontmatter).toMatch(/^\s+requires:\s+gemiterm\s*$/m);
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

  test("package.json points opencode.plugin to .opencode/opencode.json", async () => {
    const path = join(PACKAGE_ROOT, "package.json");
    const content = await readFile(path, "utf-8");
    const pkg = JSON.parse(content) as Record<string, unknown>;
    expect(pkg.name).toBe("opencode-gemiterm-skills");
    const opencode = pkg.opencode as { plugin?: unknown } | undefined;
    expect(opencode).toBeDefined();
    expect(opencode?.plugin).toBe(".opencode/opencode.json");
  });
});
