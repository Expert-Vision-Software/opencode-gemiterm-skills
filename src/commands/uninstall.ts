import { uninstall, type Scope } from "../installer.ts";

interface UninstallOptions {
  scope?: Scope;
  force?: boolean;
}

export async function uninstallCommand(options: UninstallOptions = {}): Promise<void> {
  const scope = options.scope ?? "local";
  const result = await uninstall(scope);

  if (result.removed.length === 0) {
    console.log("opencode-gemiterm-skills is not installed.");
    return;
  }

  console.log(`opencode-gemiterm-skills uninstalled ${scope === "global" ? "globally" : "locally"}:`);
  for (const p of result.removed) {
    console.log(`  Removed: ${p}`);
  }
}