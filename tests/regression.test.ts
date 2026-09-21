import { test, expect, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  install,
  status,
  migrateRootConfig,
  isConfigUnparseable,
  isPluginInConfig,
  isPluginInConfigBase,
  getGlobalConfigPath,
  getLocalConfigPath,
  getPackageDir,
  type InstallOptions,
} from "../src/installer.ts";
import { RegistrationDetector } from "../src/registration.ts";
import { installManifestPath } from "../src/manifest.ts";
import plugin from "../plugin.ts";

const PKG = "opencode-gemiterm-skills";
const LOAD_OPTIONS: InstallOptions = { addPluginConfig: false, migrateRootConfig: false, ensurePermissions: false, force: false };
const CLI_OPTIONS: InstallOptions = { addPluginConfig: true, migrateRootConfig: true, ensurePermissions: true, force: false };

let sandboxRoot: string;
let realXdg: string | undefined;

async function makeRepo(): Promise<string> {
  return mkdtemp(join(sandboxRoot, "repo-"));
}

function globalBase(): string {
  return getGlobalConfigPath();
}

async function registerGlobal(): Promise<void> {
  const cfgDir = globalBase();
  await mkdir(cfgDir, { recursive: true });
  await writeFile(join(cfgDir, "opencode.json"), JSON.stringify({ plugin: [`${PKG}@latest`] }));
}

async function registerRepoLocal(repo: string, root = false): Promise<void> {
  const cfgDir = root ? repo : join(repo, ".opencode");
  await mkdir(cfgDir, { recursive: true });
  await writeFile(join(cfgDir, "opencode.json"), JSON.stringify({ plugin: [PKG] }));
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function writeMarker(p: string, content: string): Promise<string> {
  await mkdir(join(p, ".."), { recursive: true });
  await writeFile(p, content);
  return content;
}

async function readText(p: string): Promise<string> {
  return readFile(p, "utf-8");
}

interface CapturingClient {
  logs: Array<{ body: { service: string; level: string; message: string } }>;
  toasts: Array<{ body: { title: string; message: string; variant: string } }>;
  client: {
    app: { log: (entry: { body: { service: string; level: string; message: string } }) => Promise<void> };
    tui: { showToast: (entry: { body: { title: string; message: string; variant: string } }) => Promise<void> };
  };
}

function makeCapturingClient(): CapturingClient {
  const logs: CapturingClient["logs"] = [];
  const toasts: CapturingClient["toasts"] = [];
  return {
    logs,
    toasts,
    client: {
      app: { log: async (entry) => { logs.push(entry); } },
      tui: { showToast: async (entry) => { toasts.push(entry); } },
    },
  };
}

async function invokeConfigHook(directory: string, client: unknown = undefined): Promise<void> {
  const service = await (plugin as never as (input: unknown) => Promise<{ config: (c: unknown) => Promise<void> }>)({
    directory,
    client,
  });
  await service.config({});
}

function lenientJsoncFixture(packageName: string): string {
  return [
    "{",
    "  // repo-local registration for this checkout",
    '  "$schema": "https://opencode.ai/config.json",',
    "  /* block comment: trailing comma follows */",
    '  "plugin": [',
    `    "${packageName}",`,
    "  ],",
    "}",
  ].join("\n");
}

beforeAll(async () => {
  sandboxRoot = await mkdtemp(join(tmpdir(), "gemiterm-skills-test-"));
  realXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = join(sandboxRoot, "global-config");
  await mkdir(globalBase(), { recursive: true });
});

beforeEach(async () => {
  await rm(globalBase(), { recursive: true, force: true });
  await mkdir(globalBase(), { recursive: true });
});

afterAll(async () => {
  process.env.XDG_CONFIG_HOME = realXdg;
  await rm(sandboxRoot, { recursive: true, force: true });
});

describe("registration detection", () => {
  test("performs zero writes", async () => {
    const repo = await makeRepo();

    const snapshot = () => Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: repo, dot: true }));
    const expectSame = async (before: string[], run: () => Promise<unknown>, expected: string) => {
      const filesBefore = await snapshot();
      expect(await run()).toBe(expected);
      expect(await snapshot()).toEqual(filesBefore);
    };

    await expectSame([], () => RegistrationDetector.detect(repo), "none");

    await registerGlobal();
    await expectSame([], () => RegistrationDetector.detect(repo), "global");

    await rm(join(globalBase(), "opencode.json"));
    await registerRepoLocal(repo);
    await expectSame(
      [],
      () => RegistrationDetector.detect(repo),
      "repo-local",
    );

    await registerGlobal();
    await expectSame(
      [".opencode\\opencode.json"],
      () => RegistrationDetector.detect(repo),
      "both",
    );
  });

  test("scopesToEnsure maps contexts correctly", () => {
    expect(RegistrationDetector.scopesToEnsure("none")).toEqual([]);
    expect(RegistrationDetector.scopesToEnsure("global")).toEqual(["global"]);
    expect(RegistrationDetector.scopesToEnsure("repo-local")).toEqual(["local"]);
    expect(RegistrationDetector.scopesToEnsure("both")).toEqual(["global", "local"]);
  });

  test("matches name@latest, name@x.y.z, and casing", async () => {
    const repo = await makeRepo();
    const cfgDir = join(repo, ".opencode");
    await mkdir(cfgDir, { recursive: true });
    await writeFile(
      join(cfgDir, "opencode.json"),
      JSON.stringify({ plugin: ["Opencode-Gemiterm-Skills@1.0.0", "other-pkg"] }),
    );
    expect(await RegistrationDetector.detect(repo)).toBe("repo-local");
  });

  test("treats repo-root opencode.json registration as repo-local", async () => {
    const repo = await makeRepo();
    await registerRepoLocal(repo, true);
    expect(await RegistrationDetector.detect(repo)).toBe("repo-local");
  });

  test("returns global for a global opencode.jsonc registration", async () => {
    const repo = await makeRepo();
    await writeFile(join(globalBase(), "opencode.jsonc"), JSON.stringify({ plugin: [PKG] }));

    expect(await RegistrationDetector.detect(repo)).toBe("global");
  });

  test("returns repo-local for a nested .opencode/opencode.jsonc registration", async () => {
    const repo = await makeRepo();
    await mkdir(join(repo, ".opencode"), { recursive: true });
    await writeFile(join(repo, ".opencode", "opencode.jsonc"), JSON.stringify({ plugin: [PKG] }));

    expect(await RegistrationDetector.detect(repo)).toBe("repo-local");
  });

  test("returns repo-local for a repo-root opencode.jsonc registration", async () => {
    const repo = await makeRepo();
    await writeFile(join(repo, "opencode.jsonc"), JSON.stringify({ plugin: [PKG] }));

    expect(await RegistrationDetector.detect(repo)).toBe("repo-local");
  });

  test("returns both when global jsonc and nested json register the package", async () => {
    const repo = await makeRepo();
    await writeFile(join(globalBase(), "opencode.jsonc"), JSON.stringify({ plugin: [PKG] }));
    await registerRepoLocal(repo);

    expect(await RegistrationDetector.detect(repo)).toBe("both");
  });

  test("tolerates comments, block comments, trailing commas and a $schema URL in opencode.jsonc", async () => {
    const repo = await makeRepo();
    await writeFile(join(repo, "opencode.jsonc"), lenientJsoncFixture(PKG));

    expect(await RegistrationDetector.detect(repo)).toBe("repo-local");
  });

  test(".json stays strict: comments make it unparseable and detection falls through to .jsonc", async () => {
    const repo = await makeRepo();
    const strictPath = join(repo, "opencode.json");
    const strictContent = `{ // not valid JSON\n  "plugin": ["${PKG}"]\n}`;
    await writeFile(strictPath, strictContent);

    expect(await isConfigUnparseable(strictPath)).toBe(true);
    expect(await isPluginInConfigBase(repo, PKG)).toBe(false);
    expect(await readText(strictPath)).toBe(strictContent);

    await writeFile(join(repo, "opencode.jsonc"), JSON.stringify({ plugin: [PKG] }));
    expect(await RegistrationDetector.detect(repo)).toBe("repo-local");
  });

  test(".jsonc is lenient: comments and trailing commas are tolerated and preserved", async () => {
    const repo = await makeRepo();
    const jsoncPath = join(repo, "opencode.jsonc");
    const content = lenientJsoncFixture(PKG);
    await writeFile(jsoncPath, content);

    expect(await isConfigUnparseable(jsoncPath)).toBe(false);
    expect(await isPluginInConfigBase(repo, PKG)).toBe(true);
    expect(await readText(jsoncPath)).toBe(content);
  });

  test("truly malformed .jsonc still reports unparseable and is preserved", async () => {
    const repo = await makeRepo();
    const jsoncPath = join(repo, "opencode.jsonc");
    const content = `{ "plugin": [ }`;
    await writeFile(jsoncPath, content);

    expect(await isConfigUnparseable(jsoncPath)).toBe(true);
    expect(await isPluginInConfigBase(repo, PKG)).toBe(false);
    expect(await readText(jsoncPath)).toBe(content);
  });
});

describe("regression contract", () => {
  test("fresh repo, global context: zero repo writes; global assets + manifest ensured", async () => {
    const repo = await makeRepo();
    await registerGlobal();

    const result = await install("global", repo, LOAD_OPTIONS);
    expect(result.action).toBe("installed");
    expect(await fileExists(installManifestPath(globalBase(), PKG))).toBe(true);
    expect(await fileExists(join(globalBase(), "skills", "gemiterm", "SKILL.md"))).toBe(true);
    expect(await fileExists(join(globalBase(), "skills", "debate-with-gemini", "SKILL.md"))).toBe(true);
    expect(await fileExists(getLocalConfigPath(repo))).toBe(false);
  });

  test("fresh repo, repo-local context: repo assets + manifest ensured; global untouched", async () => {
    const repo = await makeRepo();
    await registerRepoLocal(repo);

    const result = await install("local", repo, LOAD_OPTIONS);
    expect(result.action).toBe("installed");
    expect(await fileExists(installManifestPath(getLocalConfigPath(repo), PKG))).toBe(true);
    expect(await fileExists(join(getLocalConfigPath(repo), "skills", "gemiterm", "SKILL.md"))).toBe(true);
    expect(await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: globalBase(), dot: true }))).toEqual([]);
  });

  test("repo with root opencode.json: root file never touched (global context)", async () => {
    const repo = await makeRepo();
    await registerGlobal();
    const rootCfg = await writeMarker(join(repo, "opencode.json"), '{"custom":"keep-me"}');

    await install("global", repo, LOAD_OPTIONS);

    expect(await readText(join(repo, "opencode.json"))).toEqual(rootCfg);
  });

  test("repo with root opencode.json: root file never touched (repo-local context, load options)", async () => {
    const repo = await makeRepo();
    await registerRepoLocal(repo);
    const rootCfg = await writeMarker(join(repo, "opencode.json"), '{"custom":"keep-me"}');

    await install("local", repo, LOAD_OPTIONS);

    expect(await readText(join(repo, "opencode.json"))).toEqual(rootCfg);
  });

  test("valid local config without plugin entry + global registration: zero repo writes", async () => {
    const repo = await makeRepo();
    await registerGlobal();
    const localCfg = await writeMarker(
      join(getLocalConfigPath(repo), "opencode.json"),
      JSON.stringify({ theme: "dark" }),
    );

    await install("global", repo, LOAD_OPTIONS);

    expect(await readText(join(getLocalConfigPath(repo), "opencode.json"))).toEqual(localCfg);
  });

  test("unparseable local config, global context: zero writes, preserved", async () => {
    const repo = await makeRepo();
    await registerGlobal();
    const broken = await writeMarker(join(getLocalConfigPath(repo), "opencode.json"), "{not json");

    await install("global", repo, LOAD_OPTIONS);

    expect(await readText(join(getLocalConfigPath(repo), "opencode.json"))).toEqual(broken);
    expect(await isPluginInConfig(join(getLocalConfigPath(repo), "opencode.json"))).toBe(false);
  });

  test("unparseable local config, repo-local context: skip + warn, preserved", async () => {
    const repo = await makeRepo();
    await registerRepoLocal(repo);
    const broken = await writeMarker(join(getLocalConfigPath(repo), "opencode.json"), "{not json");

    const result = await install("local", repo, LOAD_OPTIONS);

    expect(await readText(join(getLocalConfigPath(repo), "opencode.json"))).toEqual(broken);
    expect(result.pluginAdded).toBe(false);
    expect(result.action).toBe("installed");
  });

  test("version drift with identical file hashes still rewrites the manifest", async () => {
    const repo = await makeRepo();
    await registerGlobal();
    await install("global", repo, LOAD_OPTIONS);

    const manifestPath = installManifestPath(globalBase(), PKG);
    const manifest = JSON.parse(await readText(manifestPath));
    manifest.version = "0.0.1";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const skillPath = join(globalBase(), "skills", "gemiterm", "SKILL.md");
    const skillBefore = await readText(skillPath);

    const drifted = await install("global", repo, LOAD_OPTIONS);

    expect(drifted.action).toBe("upgraded");
    expect(JSON.parse(await readText(manifestPath)).version).not.toBe("0.0.1");
    expect(await readText(skillPath)).toBe(skillBefore);
  });

  test("load-path install never writes permissions; CLI install does", async () => {
    const repo = await makeRepo();
    await registerGlobal();
    await install("global", repo, LOAD_OPTIONS);

    const configPath = join(globalBase(), "opencode.json");
    await writeFile(configPath, JSON.stringify({ plugin: [`${PKG}@latest`] }));

    const manifestPath = installManifestPath(globalBase(), PKG);
    const manifest = JSON.parse(await readText(manifestPath));
    manifest.version = "0.0.1";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const loadRun = await install("global", repo, LOAD_OPTIONS);
    expect(loadRun.action).toBe("upgraded");
    expect(JSON.parse(await readText(configPath)).permission).toBeUndefined();

    manifest.version = "0.0.1";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    await install("global", repo, CLI_OPTIONS);
    expect(JSON.parse(await readText(manifestPath)).version).not.toBe("0.0.1");

    const perms = JSON.parse(await readText(configPath)).permission;
    expect(perms.skill.gemiterm).toBe("allow");
    expect(perms.skill["debate-with-gemini"]).toBe("allow");
  });

  test("up-to-date installed scope: zero writes (manifest no-op)", async () => {
    const repo = await makeRepo();
    await registerRepoLocal(repo);
    await install("local", repo, LOAD_OPTIONS);

    const manifestPath = installManifestPath(getLocalConfigPath(repo), PKG);
    const manifestBefore = await readText(manifestPath);
    const skillBefore = await readText(join(getLocalConfigPath(repo), "skills", "gemiterm", "SKILL.md"));

    const second = await install("local", repo, LOAD_OPTIONS);
    expect(second.action).toBe("noop");
    expect(await readText(manifestPath)).toEqual(manifestBefore);
    expect(await readText(join(getLocalConfigPath(repo), "skills", "gemiterm", "SKILL.md"))).toEqual(skillBefore);
  });

  test("version drift in installed scope: update that scope only", async () => {
    const repo = await makeRepo();
    await registerGlobal();
    await install("global", repo, LOAD_OPTIONS);

    const manifestPath = installManifestPath(globalBase(), PKG);
    const manifest = JSON.parse(await readText(manifestPath));
    manifest.version = "0.0.1";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const drifted = await install("global", repo, LOAD_OPTIONS);
    expect(drifted.action).toBe("upgraded");
    expect(JSON.parse(await readText(manifestPath)).version).not.toBe("0.0.1");
  });

  test("registered in both scopes: both ensured, no leakage", async () => {
    const repo = await makeRepo();
    await registerGlobal();
    await registerRepoLocal(repo);

    expect(await RegistrationDetector.detect(repo)).toBe("both");

    const repoFilesAfterRegistration = await Array.fromAsync(
      new Bun.Glob("**/*").scan({ cwd: repo, dot: true }),
    );

    await install("global", repo, LOAD_OPTIONS);

    expect(await fileExists(installManifestPath(globalBase(), PKG))).toBe(true);
    expect(await fileExists(installManifestPath(getLocalConfigPath(repo), PKG))).toBe(false);
    expect(
      await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: repo, dot: true })),
    ).toEqual(repoFilesAfterRegistration);

    await install("local", repo, LOAD_OPTIONS);
    expect(await fileExists(installManifestPath(getLocalConfigPath(repo), PKG))).toBe(true);
    expect(
      await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: globalBase(), dot: true }))      .then((files) => files.filter((f) => f.endsWith(".json")).sort()),
    ).toEqual(["opencode-gemiterm-skills.manifest.json", "opencode.json"]);
  });

  test("consumer-modified installed file: skipped at load, overwritten only with --force", async () => {
    const repo = await makeRepo();
    await registerGlobal();
    await install("global", repo, LOAD_OPTIONS);

    const skillPath = join(globalBase(), "skills", "gemiterm", "SKILL.md");
    await writeMarker(skillPath, "consumer edit");

    const loadRun = await install("global", repo, LOAD_OPTIONS);
    expect(loadRun.action).toBe("noop");
    expect(await readText(skillPath)).toBe("consumer edit");

    const forced = await install("global", repo, { ...LOAD_OPTIONS, force: true });
    expect(forced.action).toBe("upgraded");
    expect(await readText(skillPath)).not.toBe("consumer edit");
  });

  test(".version markers are reconciled on first manifest-era install", async () => {
    const repo = await makeRepo();
    await registerGlobal();
    const markerPath = join(globalBase(), "skills", "gemiterm", ".version");
    await writeMarker(markerPath, "0.6.0");

    await install("global", repo, LOAD_OPTIONS);

    expect(await fileExists(markerPath)).toBe(false);
  });

  test("root-config migration is CLI-only", async () => {
    const repo = await makeRepo();
    await registerRepoLocal(repo);
    const rootCfg = await writeMarker(join(repo, "opencode.json"), '{"a":1}');

    await install("local", repo, LOAD_OPTIONS);
    expect(await fileExists(join(repo, "opencode.json"))).toBe(true);

    await install("local", repo, CLI_OPTIONS);
    expect(await fileExists(join(repo, "opencode.json"))).toBe(false);
    expect(JSON.parse(await readText(join(getLocalConfigPath(repo), "opencode.json"))).a).toBe(1);
    void rootCfg;
  });

  test("migrateRootConfig refuses unparseable root config and preserves both files", async () => {
    const repo = await makeRepo();
    const rootCfg = await writeMarker(join(repo, "opencode.json"), "{broken");
    await mkdir(join(repo, ".opencode"));
    await writeFile(join(repo, ".opencode", "opencode.json"), "{}");

    expect(await migrateRootConfig(repo)).toBe(false);
    expect(await readText(join(repo, "opencode.json"))).toEqual(rootCfg);
  });

  test("CLI install writes canonical name@latest plugin entry with semantic dedup", async () => {
    const repo = await makeRepo();
    await writeMarker(
      join(getLocalConfigPath(repo), "opencode.json"),
      JSON.stringify({ plugin: [`${PKG}@latest`] }),
    );

    const result = await install("local", repo, CLI_OPTIONS);

    expect(result.pluginAdded).toBe(false);
    const plugins = JSON.parse(
      await readText(join(getLocalConfigPath(repo), "opencode.json")),
    ).plugin;
    expect(plugins.filter((p: string) => p.startsWith(PKG))).toEqual([`${PKG}@latest`]);
  });

  test("advisory suppressed when any scope holds an install", async () => {
    const repo = await makeRepo();
    expect(await RegistrationDetector.hasAnyInstallation(repo)).toBe(false);

    await install("global", repo, LOAD_OPTIONS);
    expect(await RegistrationDetector.hasAnyInstallation(repo)).toBe(true);
  });

  test("the package checkout with no registration is detected as none (detection is config-based)", async () => {
    expect(await RegistrationDetector.detect(getPackageDir())).toBe("none");
  });

  test("repo-local opencode.jsonc registration ensures assets, preserves the jsonc, and creates no opencode.json", async () => {
    const repo = await makeRepo();
    const localDir = getLocalConfigPath(repo);
    await mkdir(localDir, { recursive: true });
    const jsoncPath = join(localDir, "opencode.jsonc");
    const jsoncContent = lenientJsoncFixture(PKG);
    await writeFile(jsoncPath, jsoncContent);

    await invokeConfigHook(repo);

    expect(await readText(jsoncPath)).toBe(jsoncContent);
    expect(await fileExists(join(localDir, "opencode.json"))).toBe(false);
    expect(await fileExists(join(localDir, "skills", "gemiterm", "SKILL.md"))).toBe(true);
    expect(await fileExists(join(localDir, "skills", "debate-with-gemini", "SKILL.md"))).toBe(true);
    expect(await fileExists(installManifestPath(localDir, PKG))).toBe(true);
  });

  test("plugin hook: advisory fires exactly once per session with zero writes", async () => {
    const repo = await makeRepo();
    const logs: string[] = [];
    const fakeClient = {
      app: { log: async (b: unknown) => { logs.push((b as { body: { message: string } }).body.message); } },
      tui: { showToast: async () => {} },
    };

    const service = await (plugin as never as (input: unknown) => Promise<{ config: (c: unknown) => Promise<void> }>)({
      directory: repo,
      client: fakeClient,
    });
    await service.config({});
    await service.config({});

    expect(logs.filter((m) => m.includes("not installed in any scope")).length).toBe(1);
    expect(await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: globalBase(), dot: true }))).toEqual([]);
  });

  test("status reports manifest version per scope with legacy fallback", async () => {
    const repo = await makeRepo();
    const none = await status(repo);
    expect(none.local).toBeNull();
    expect(none.global).toBeNull();

    await install("global", repo, LOAD_OPTIONS);
    const installed = await status(repo);
    expect(installed.global?.installed).toBe(true);
    expect(installed.global?.version).toBeTruthy();
    expect(installed.local).toBeNull();

    const legacyRepo = await makeRepo();
    const legacyBase = getLocalConfigPath(legacyRepo);
    await writeMarker(join(legacyBase, "skills", "gemiterm", ".version"), "0.6.0");
    const legacy = await status(legacyRepo);
    expect(legacy.local?.installed).toBe(true);
    expect(legacy.local?.version).toBe("0.6.0");
  });
});
