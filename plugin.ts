import type { Plugin, Config, PluginInput } from "@opencode-ai/plugin";
import { install, type Scope, type InstallResult } from "./src/installer.ts";
import { RegistrationDetector } from "./src/registration.ts";
import {
  createAdvisoryContext,
  maybeEmitInstallAdvisory,
  reportLoadSkippedFiles,
  type AdvisoryContext,
} from "./src/advisory.ts";

const LOAD_INSTALL_OPTIONS = { addPluginConfig: false, migrateRootConfig: false, force: false };

async function ensureScopeAssets(context: AdvisoryContext, scope: Scope): Promise<InstallResult> {
  const result = await install(scope, context.directory, LOAD_INSTALL_OPTIONS);
  await reportLoadSkippedFiles(context, result);
  return result;
}

const plugin: Plugin = async ({ directory, client }: PluginInput) => {
  const advisory = createAdvisoryContext(client, directory);

  return {
    config: async (_input: Config) => {
      const detected = await RegistrationDetector.detect(directory);
      for (const scope of RegistrationDetector.scopesToEnsure(detected)) {
        await ensureScopeAssets(advisory, scope);
      }
      await maybeEmitInstallAdvisory(advisory);
    },
  };
};

export default plugin;
