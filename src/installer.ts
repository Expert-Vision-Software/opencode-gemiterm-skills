import { copyFile, exists, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PluginNameNormalizer } from "./plugin-name.ts";
import { InstallManifest, installManifestPath, toManifestPath, type ManifestFileEntry } from "./manifest.ts";

export type Scope = "local" | "global";

export interface InstallOptions {
  addPluginConfig: boolean;
  migrateRootConfig: boolean;
  ensurePermissions: boolean;
  force: boolean;
}

export type InstallAction = "installed" | "upgraded" | "noop";

export interface InstallResult {
  action: InstallAction;
  scope: Scope;
  skillPaths: string[];
  configPath: string;
  manifestPath: string;
  skipped: string[];
  migrated: boolean;
  pluginAdded: boolean;
}

export interface UninstallResult {
  scope: Scope;
  removed: string[];
  pluginRemoved: boolean;
}

export interface ScopeStatus {
  installed: boolean;
  version: string;
  pluginInConfig: boolean;
}

export interface StatusResult {
  local: ScopeStatus | null;
  global: ScopeStatus | null;
}

const SKILL_NAMES = ["gemiterm", "debate-with-gemini"] as const;
export const PACKAGE_NAME = "opencode-gemiterm-skills";
export const CONFIG_FILE_NAMES = ["opencode.json", "opencode.jsonc"] as const;

export function normalizePluginName(entry: string): string {
  return PluginNameNormalizer.normalize(entry);
}

export function isOurPluginEntry(entry: string): boolean {
  return PluginNameNormalizer.matches(entry, PACKAGE_NAME);
}

export function getPackageName(): string {
  return PACKAGE_NAME;
}

export async function getPackageVersion(): Promise<string> {
  const content = await Bun.file(join(getPackageDir(), "package.json")).text();
  return JSON.parse(content).version;
}

export function getPackageDir(): string {
  return join(fileURLToPath(new URL("../", import.meta.url)));
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

function isFileNotFoundError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

interface PlannedAssetFile {
  sourcePath: string;
  relativeDest: string;
}

export function skillSourceMissingError(
  skillSourcePath: string,
  packageName: string,
  packageVersion: string,
): string {
  const cacheDir = `~/.cache/opencode/packages/${packageName}@${packageVersion}`;
  return (
    `Package skills not found at ${skillSourcePath}. ` +
    `Installs must run from the published package (e.g. "bunx ${packageName}@latest install" ` +
    `or a global install), never from a partial cache artifact. ` +
    `If OpenCode loaded this copy from its plugin cache, remove the cached copy so the next start ` +
    `re-installs it, then restart: "rm -rf ${cacheDir}"`
  );
}

async function collectSkillFiles(packageDir: string, packageVersion: string): Promise<PlannedAssetFile[]> {
  const planned: PlannedAssetFile[] = [];
  for (const name of SKILL_NAMES) {
    const skillSource = join(packageDir, "skills", name);
    if (!(await exists(skillSource))) {
      throw new Error(skillSourceMissingError(skillSource, PACKAGE_NAME, packageVersion));
    }
    planned.push(...(await collectNestedFiles(skillSource, join("skills", name))));
  }
  return planned;
}

async function collectNestedFiles(directory: string, relativeBase: string): Promise<PlannedAssetFile[]> {
  const planned: PlannedAssetFile[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const nestedSource = join(directory, entry.name);
    const nestedDest = join(relativeBase, entry.name);
    if (entry.isDirectory()) {
      planned.push(...(await collectNestedFiles(nestedSource, nestedDest)));
    } else {
      planned.push({ sourcePath: nestedSource, relativeDest: nestedDest });
    }
  }
  return planned;
}

function requiredRecordedHash(manifest: InstallManifest, relativePath: string): string {
  const recorded = manifest.recordedHash(relativePath);
  if (recorded === null) {
    throw new Error(`Manifest disposition required a recorded hash for: ${relativePath}`);
  }
  return recorded;
}

function writtenSkillDirs(configBase: string, writtenRelativePaths: string[]): string[] {
  const dirs = new Set<string>();
  for (const relativePath of writtenRelativePaths) {
    const manifestPath = toManifestPath(relativePath);
    if (!manifestPath.startsWith("skills/")) {
      continue;
    }
    const skillName = manifestPath.slice("skills/".length).split("/")[0];
    dirs.add(join(configBase, "skills", skillName));
  }
  return [...dirs];
}

function stripJsoncSyntax(source: string): string {
  let stripped = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (inString) {
      stripped += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      stripped += char;
      continue;
    }
    if (char === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== "\n") {
        index++;
      }
      continue;
    }
    if (char === "/" && source[index + 1] === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index++;
      }
      index++;
      continue;
    }
    if (char === ",") {
      const next = skipJsoncTrivia(source, index + 1);
      if (source[next] === "}" || source[next] === "]") {
        continue;
      }
    }
    stripped += char;
  }
  return stripped;
}

function skipJsoncTrivia(source: string, start: number): number {
  let index = start;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (char === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== "\n") {
        index++;
      }
      continue;
    }
    if (char === "/" && source[index + 1] === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index++;
      }
      index += 2;
      continue;
    }
    break;
  }
  return index;
}

function parseConfigContent(content: string, path: string): Record<string, unknown> | null {
  const tolerated = path.endsWith(".jsonc") ? stripJsoncSyntax(content) : content;
  try {
    return JSON.parse(tolerated);
  } catch {
    return null;
  }
}

async function readJsonConfig(path: string): Promise<Record<string, unknown> | null> {
  let content: string;
  try {
    content = await readFile(path, "utf-8");
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return {};
    }
    return null;
  }
  return parseConfigContent(content, path);
}

async function writeJsonConfig(path: string, config: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2));
}

async function readConfigGuarded(configPath: string): Promise<Record<string, unknown> | null> {
  const config = await readJsonConfig(configPath);
  if (config === null) {
    console.warn(
      `[${PACKAGE_NAME}] Refusing to write ${configPath}: the file is not valid JSON. ` +
        `Fix or remove the file, then re-run install. The file was left unchanged.`
    );
  }
  return config;
}

export async function isConfigUnparseable(configPath: string): Promise<boolean> {
  if (!(await exists(configPath))) {
    return false;
  }
  return (await readJsonConfig(configPath)) === null;
}

async function ensureSkillPermissions(configPath: string, skillNames: readonly string[]): Promise<boolean> {
  const config = await readConfigGuarded(configPath);
  if (config === null) {
    return false;
  }

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
    await writeJsonConfig(configPath, config);
  }
  return changed;
}

async function addPluginToConfig(configPath: string): Promise<boolean> {
  const config = await readConfigGuarded(configPath);
  if (config === null) {
    return false;
  }

  if (!config.plugin) {
    config.plugin = [];
  }

  const plugins = config.plugin as string[];
  if (plugins.some(isOurPluginEntry)) {
    return false;
  }

  plugins.push(PluginNameNormalizer.canonicalize(PACKAGE_NAME));
  config.plugin = plugins;

  await writeJsonConfig(configPath, config);
  return true;
}

async function removePluginFromConfig(configPath: string): Promise<boolean> {
  const config = await readConfigGuarded(configPath);
  if (config === null) {
    return false;
  }

  if (!config.plugin) {
    return false;
  }

  const plugins = config.plugin as string[];
  const filtered = plugins.filter((p) => !isOurPluginEntry(p));
  if (filtered.length === plugins.length) return false;
  if (filtered.length === 0) delete config.plugin;
  else config.plugin = filtered;

  await writeJsonConfig(configPath, config);
  return true;
}

export async function isPluginInConfig(configPath: string, packageName: string = PACKAGE_NAME): Promise<boolean> {
  const config = await readJsonConfig(configPath);
  if (config === null) {
    return false;
  }
  if (!config.plugin) {
    return false;
  }
  const plugins = config.plugin as string[];
  return plugins.some(entry => PluginNameNormalizer.matches(entry, packageName));
}

export async function isPluginInConfigBase(configBase: string, packageName: string): Promise<boolean> {
  for (const fileName of CONFIG_FILE_NAMES) {
    if (await isPluginInConfig(join(configBase, fileName), packageName)) {
      return true;
    }
  }
  return false;
}

export async function checkMigrationNeeded(projectDir: string): Promise<{
  needed: boolean;
  rootConfigPath: string;
  dotOpencodeConfigPath: string;
}> {
  const rootConfigPath = join(projectDir, "opencode.json");
  const dotOpencodeConfigPath = join(projectDir, ".opencode", "opencode.json");
  const rootExists = await exists(rootConfigPath);
  if (!rootExists) return { needed: false, rootConfigPath, dotOpencodeConfigPath };
  return { needed: true, rootConfigPath, dotOpencodeConfigPath };
}

export async function migrateRootConfig(projectDir: string): Promise<boolean> {
  const { needed, rootConfigPath, dotOpencodeConfigPath } = await checkMigrationNeeded(projectDir);
  if (!needed) return false;

  const rootConfig = await readConfigGuarded(rootConfigPath);
  if (rootConfig === null) {
    return false;
  }

  const dotOpencodeExists = await exists(dotOpencodeConfigPath);
  const dotConfig = dotOpencodeExists ? await readJsonConfig(dotOpencodeConfigPath) : null;
  if (dotConfig === null && dotOpencodeExists) {
    console.warn(
      `Refusing to migrate ${rootConfigPath}: ${dotOpencodeConfigPath} is not valid JSON. ` +
        `Both files were left unchanged.`
    );
    return false;
  }

  if (dotConfig) {
    await writeJsonConfig(dotOpencodeConfigPath, { ...rootConfig, ...dotConfig });
  } else {
    await writeJsonConfig(dotOpencodeConfigPath, rootConfig);
  }
  await rm(rootConfigPath);
  return true;
}

export async function install(
  scope: Scope,
  projectDir: string = process.cwd(),
  options: InstallOptions = { addPluginConfig: true, migrateRootConfig: true, ensurePermissions: false, force: false },
  packageDir: string = getPackageDir(),
): Promise<InstallResult> {
  const packageVersion = await getPackageVersion();

  const { addPluginConfig, migrateRootConfig: allowRootMigration, ensurePermissions, force } = options;

  const configBase = scope === "global" ? getGlobalConfigPath() : getLocalConfigPath(projectDir);
  const configPath = join(configBase, "opencode.json");
  const manifestPath = installManifestPath(configBase, PACKAGE_NAME);

  let migrated = false;
  if (scope === "local" && allowRootMigration) {
    migrated = await migrateRootConfig(projectDir);
  }

  const manifest = await InstallManifest.read(manifestPath);
  const sameVersion = manifest.matchesVersion(packageVersion);
  const plannedFiles = await collectSkillFiles(packageDir, packageVersion);

  const writtenRelativePaths: string[] = [];
  const skipped: string[] = [];
  const recordedFiles: ManifestFileEntry[] = [];

  for (const plannedFile of plannedFiles) {
    const manifestEntryPath = toManifestPath(plannedFile.relativeDest);
    const verdict = await manifest.disposition(configBase, plannedFile.relativeDest, sameVersion, force);

    if (verdict === "skip") {
      skipped.push(manifestEntryPath);
      recordedFiles.push({ path: manifestEntryPath, hash: requiredRecordedHash(manifest, plannedFile.relativeDest) });
      continue;
    }

    const installedPath = join(configBase, plannedFile.relativeDest);

    if (verdict === "keep") {
      recordedFiles.push({ path: manifestEntryPath, hash: requiredRecordedHash(manifest, plannedFile.relativeDest) });
      continue;
    }

    await mkdir(dirname(installedPath), { recursive: true });
    await copyFile(plannedFile.sourcePath, installedPath);
    const installedHash = await InstallManifest.hashFile(installedPath);
    if (installedHash === null) {
      throw new Error(`Failed to hash installed file: ${installedPath}`);
    }
    recordedFiles.push({ path: manifestEntryPath, hash: installedHash });
    writtenRelativePaths.push(plannedFile.relativeDest);
  }

  const wroteFiles = writtenRelativePaths.length > 0;
  const needsManifestRewrite = wroteFiles || !sameVersion;
  const action: InstallAction = !needsManifestRewrite
    ? "noop"
    : manifest.hasContents()
      ? "upgraded"
      : "installed";

  if (needsManifestRewrite) {
    const filesToRecord = wroteFiles ? recordedFiles : manifest.files;
    await InstallManifest.write(manifestPath, packageVersion, filesToRecord);
    if (ensurePermissions) {
      await ensureSkillPermissions(configPath, SKILL_NAMES);
    }
  }

  let pluginAdded = false;
  if (addPluginConfig) {
    pluginAdded = await addPluginToConfig(configPath);
  }

  return {
    action,
    scope,
    skillPaths: writtenSkillDirs(configBase, writtenRelativePaths),
    configPath,
    manifestPath,
    skipped,
    migrated,
    pluginAdded,
  };
}

export async function uninstall(
  scope: Scope,
  projectDir: string = process.cwd(),
): Promise<UninstallResult> {
  const configBase = scope === "global" ? getGlobalConfigPath() : getLocalConfigPath(projectDir);
  const configPath = join(configBase, "opencode.json");

  const removed: string[] = [];
  for (const name of SKILL_NAMES) {
    const skillPath = join(configBase, "skills", name);
    if (await exists(skillPath)) {
      await rm(skillPath, { recursive: true });
      removed.push(skillPath);
    }
  }

  const manifestPath = installManifestPath(configBase, PACKAGE_NAME);
  if (await exists(manifestPath)) {
    await rm(manifestPath);
    removed.push(manifestPath);
  }

  let pluginRemoved = false;
  if (await exists(configPath)) {
    pluginRemoved = await removePluginFromConfig(configPath);
  }

  return { scope, removed, pluginRemoved };
}

export async function status(projectDir: string = process.cwd()): Promise<StatusResult> {
  return {
    local: await readScopeStatus(getLocalConfigPath(projectDir)),
    global: await readScopeStatus(getGlobalConfigPath()),
  };
}

export async function isScopeInstalled(configBase: string): Promise<boolean> {
  return (await readScopeStatus(configBase)) !== null;
}

async function readScopeStatus(configBase: string): Promise<ScopeStatus | null> {
  const manifest = await InstallManifest.read(installManifestPath(configBase, PACKAGE_NAME));
  const version = manifest.version;
  if (version === null) {
    return null;
  }
  const pluginInConfig = await isPluginInConfig(join(configBase, "opencode.json"));
  return { installed: true, version, pluginInConfig };
}
