import { install, type InstallOptions, type Scope } from "../installer.ts";

interface InstallCommandOptions {
  scope?: Scope;
  force?: boolean;
  migrateRootConfig?: boolean;
}

export async function installCommand(options: InstallCommandOptions = {}): Promise<void> {
  const scope = options.scope ?? "local";
  const installOptions: InstallOptions = {
    addPluginConfig: true,
    migrateRootConfig: options.migrateRootConfig ?? false,
    ensurePermissions: true,
    force: options.force ?? false,
  };
  const result = await install(scope, process.cwd(), installOptions);

  if (result.action === "noop") {
    console.log(`opencode-gemiterm-skills already up to date [${scope}].`);
    return;
  }

  console.log(
    `opencode-gemiterm-skills ${result.action === "installed" ? "installed" : "updated"} ${scope === "global" ? "globally" : "locally"}:`,
  );
  for (const p of result.skillPaths) {
    console.log(`  ${p}`);
  }
  for (const p of result.skipped) {
    console.log(`  Skipped consumer-modified file (use --force to overwrite): ${p}`);
  }
  if (result.migrated) {
    console.log("  Migrated: opencode.json → .opencode/opencode.json");
  }
  if (result.pluginAdded) {
    console.log(`  Added plugin entry to ${result.configPath}`);
  }
}
