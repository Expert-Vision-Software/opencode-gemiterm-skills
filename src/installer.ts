import { exists, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type Scope = "local" | "global";

export interface InstallResult {
  scope: Scope;
  skillPaths: string[];
  configPath: string;
  migrated: boolean;
  permissionConfigured: boolean;
  pluginAdded: boolean;
}

export interface UninstallResult {
  scope: Scope;
  removed: string[];
  pluginRemoved: boolean;
}

export interface StatusResult {
  installed: boolean;
  version: string | null;
  scope: Scope | null;
  pluginInConfig: boolean;
}

const SKILL_NAMES = ["gemiterm", "debate-with-gemini"] as const;
const PACKAGE_NAME = "opencode-gemiterm-skills";

export async function getPackageVersion(): Promise<string> {
  const content = await Bun.file(`${import.meta.dirname}/../package.json`).text();
  return JSON.parse(content).version;
}

function getPackageDir(): string {
  return join(import.meta.dirname, "..");
}

export function getGlobalConfigPath(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    return join(xdgConfig, "opencode");
  }
  return join(homedir(), ".config", "opencode");
}

export function getLocalConfigPath(projectDir: string): string {
  return join(projectDir, ".opencode");
}

async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  for (const entry of await readdir(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else {
      await Bun.write(d, Bun.file(s));
    }
  }
}

async function readJsonConfig(path: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return {};
  }
}

async function writeJsonConfig(path: string, config: Record<string, unknown>): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2));
}

async function ensureSkillPermissions(configPath: string, skillNames: readonly string[]): Promise<boolean> {
  const config = await readJsonConfig(configPath);
  if (!config.permission) config.permission = {};
  if (!(config.permission as Record<string, unknown>).skill) (config.permission as Record<string, unknown>).skill = {};
  const skillPerms = (config.permission as Record<string, unknown>).skill as Record<string, unknown>;
  let changed = false;
  for (const name of skillNames) {
    if (skillPerms[name] !== "allow") {
      skillPerms[name] = "allow";
      changed = true;
    }
  }
  if (changed) {
    await mkdir(join(configPath, ".."), { recursive: true });
    await writeFile(configPath, JSON.stringify(config, null, 2));
  }
  return changed;
}

async function addPluginToConfig(configPath: string): Promise<boolean> {
  const config = await readJsonConfig(configPath);
  if (!config.plugin) config.plugin = [];
  const plugins = config.plugin as string[];
  if (plugins.includes(PACKAGE_NAME)) return false;
  plugins.push(PACKAGE_NAME);
  await mkdir(join(configPath, ".."), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2));
  return true;
}

async function removePluginFromConfig(configPath: string): Promise<boolean> {
  const config = await readJsonConfig(configPath);
  if (!config.plugin) return false;
  const plugins = config.plugin as string[];
  const idx = plugins.indexOf(PACKAGE_NAME);
  if (idx === -1) return false;
  plugins.splice(idx, 1);
  if (plugins.length === 0) delete config.plugin;
  await mkdir(join(configPath, ".."), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2));
  return true;
}

async function isPluginInConfig(configPath: string): Promise<boolean> {
  const config = await readJsonConfig(configPath);
  if (!config.plugin) return false;
  return (config.plugin as string[]).includes(PACKAGE_NAME);
}

async function checkMigrationNeeded(projectDir: string) {
  const rootConfigPath = join(projectDir, "opencode.json");
  const dotOpencodeConfigPath = join(projectDir, ".opencode", "opencode.json");
  const rootExists = await exists(rootConfigPath);
  if (!rootExists) return { needed: false, rootConfigPath, dotOpencodeConfigPath };
  return { needed: true, rootConfigPath, dotOpencodeConfigPath };
}

async function migrateRootConfig(projectDir: string): Promise<boolean> {
  const { needed, rootConfigPath, dotOpencodeConfigPath } = await checkMigrationNeeded(projectDir);
  if (!needed) return false;
  const rootConfig = await readJsonConfig(rootConfigPath);
  const dotOpencodeExists = await exists(dotOpencodeConfigPath);
  if (dotOpencodeExists) {
    const dotConfig = await readJsonConfig(dotOpencodeConfigPath);
    const merged = { ...rootConfig, ...dotConfig };
    await writeJsonConfig(dotOpencodeConfigPath, merged);
  } else {
    await mkdir(join(projectDir, ".opencode"), { recursive: true });
    await writeJsonConfig(dotOpencodeConfigPath, rootConfig);
  }
  await rm(rootConfigPath);
  return true;
}

export async function install(
  scope: Scope,
  projectDir: string = process.cwd(),
): Promise<InstallResult> {
  const version = await getPackageVersion();
  const pkgDir = getPackageDir();

  const configBase =
    scope === "global" ? getGlobalConfigPath() : getLocalConfigPath(projectDir);

  const skillPaths: string[] = [];

  let migrated = false;
  if (scope === "local") {
    migrated = await migrateRootConfig(projectDir);
  }

  for (const name of SKILL_NAMES) {
    const srcSkillDir = join(pkgDir, "assets", "skills", name);
    const destSkillDir = join(configBase, "skills", name);
    await copyDir(srcSkillDir, destSkillDir);
    skillPaths.push(destSkillDir);
    await Bun.write(join(destSkillDir, ".version"), version);
  }

  const configPath = join(configBase, "opencode.json");
  const permissionConfigured = await ensureSkillPermissions(configPath, SKILL_NAMES);
  const pluginAdded = await addPluginToConfig(configPath);

  return { scope, skillPaths, configPath, migrated, permissionConfigured, pluginAdded };
}

export async function uninstall(
  scope: Scope,
  projectDir: string = process.cwd(),
): Promise<UninstallResult> {
  const configBase =
    scope === "global" ? getGlobalConfigPath() : getLocalConfigPath(projectDir);

  const removed: string[] = [];
  for (const name of SKILL_NAMES) {
    const skillPath = join(configBase, "skills", name);
    if (await exists(skillPath)) {
      await rm(skillPath, { recursive: true });
      removed.push(skillPath);
    }
  }

  const configPath = join(configBase, "opencode.json");
  const pluginRemoved = await removePluginFromConfig(configPath);

  return { scope, removed, pluginRemoved };
}

export async function status(projectDir: string = process.cwd()): Promise<StatusResult> {
  const version = await getPackageVersion();

  for (const scope of ["local", "global"] as Scope[]) {
    const configBase =
      scope === "global" ? getGlobalConfigPath() : getLocalConfigPath(projectDir);
    const versionMarker = join(configBase, "skills", SKILL_NAMES[0], ".version");
    const configPath = join(configBase, "opencode.json");

    try {
      const installedVersion = (await readFile(versionMarker, "utf-8")).trim();
      const pluginInConfig = await isPluginInConfig(configPath);
      return { installed: true, version: installedVersion, scope, pluginInConfig };
    } catch {
      const firstSkillPath = join(configBase, "skills", SKILL_NAMES[0]);
      if (await exists(firstSkillPath)) {
        const pluginInConfig = await isPluginInConfig(configPath);
        return { installed: true, version: null, scope, pluginInConfig };
      }
    }
  }

  return { installed: false, version: null, scope: null, pluginInConfig: false };
}