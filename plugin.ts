import type { Plugin } from "@opencode-ai/plugin";

function buildPlugin(): Plugin {
  return async () => ({});
}

const plugin: Plugin = buildPlugin();

export default plugin;
