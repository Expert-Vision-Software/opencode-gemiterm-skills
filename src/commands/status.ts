import { status } from "../installer.ts";

export async function statusCommand(): Promise<void> {
  const result = await status();

  if (!result.installed) {
    console.log("opencode-gemiterm-skills is not installed.");
    return;
  }

  console.log(`opencode-gemiterm-skills [${result.scope}]`);
  console.log(`  Installed: yes`);
  if (result.version) console.log(`  Version: ${result.version}`);
  console.log(`  Plugin in config: ${result.pluginInConfig ? "yes" : "no"}`);
}