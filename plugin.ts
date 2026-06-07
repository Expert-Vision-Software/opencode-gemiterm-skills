import type { Plugin } from "@opencode-ai/plugin";
import { install, getPackageVersion } from "./src/installer.ts";
import { join } from "node:path";

const plugin: Plugin = async ({ directory }) => ({
  config: async () => {
    const version = await getPackageVersion();
    const globalConfigPath = join(
      process.env.XDG_CONFIG_HOME ?? join(require("node:os").homedir(), ".config"),
      "opencode",
    );

    const isGlobal =
      directory === globalConfigPath || directory.startsWith(globalConfigPath + "/") ||
      directory.startsWith(globalConfigPath + "\\");

    const scope = isGlobal ? "global" : "local";
    const versionMarker = join(
      isGlobal ? globalConfigPath : directory,
      "skills",
      "gemiterm",
      ".version",
    );

    try {
      const installed = (await Bun.file(versionMarker).text()).trim();
      if (installed === version) return;
    } catch {
      // Not installed, proceed
    }

    await install(scope, directory);
  },
});

export default plugin;