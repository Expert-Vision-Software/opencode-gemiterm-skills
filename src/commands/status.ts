import { status, type ScopeStatus, type StatusResult } from "../installer.ts";

export async function statusCommand(): Promise<void> {
  const result = await status();

  let anyInstalled = false;

  for (const [scope, scopeStatus] of Object.entries(result) as [keyof StatusResult, ScopeStatus | null][]) {
    if (scopeStatus === null) {
      console.log(`opencode-gemiterm-skills [${scope}]: not installed`);
      continue;
    }
    anyInstalled = true;
    console.log(`opencode-gemiterm-skills [${scope}]`);
    console.log(`  Installed: yes`);
    console.log(`  Version: ${scopeStatus.version}`);
    console.log(`  Plugin in config: ${scopeStatus.pluginInConfig ? "yes" : "no"}`);
  }

  if (!anyInstalled) {
    console.log("opencode-gemiterm-skills is not installed.");
  }
}
