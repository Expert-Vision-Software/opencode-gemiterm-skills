import { install, type Scope } from "../installer.ts";

interface InstallOptions {
  scope?: Scope;
  force?: boolean;
}

export async function installCommand(options: InstallOptions = {}): Promise<void> {
  const scope = options.scope ?? "local";
  const result = await install(scope);

  console.log(
    `opencode-gemiterm-skills installed ${scope === "global" ? "globally" : "locally"}:`,
  );
  for (const p of result.skillPaths) {
    console.log(`  ${p}`);
  }
  if (result.migrated) {
    console.log("  Migrated: opencode.json → .opencode/opencode.json");
  }
}