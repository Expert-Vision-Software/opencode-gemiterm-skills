import type { Plugin, Config, PluginInput } from "@opencode-ai/plugin";
import { install, type Scope, type InstallResult } from "./src/installer.ts";
import { RegistrationDetector } from "./src/registration.ts";

const PLUGIN_SERVICE_NAME = "opencode-gemiterm-skills";
const ADVISORY_TOAST_DURATION_MS = 10000;
const INSTALL_ADVISORY_MESSAGE = `${PLUGIN_SERVICE_NAME} is not installed in any scope. Run "bunx ${PLUGIN_SERVICE_NAME} install --scope global" to enable the gemiterm and debate-with-gemini skills.`;
const LOAD_INSTALL_OPTIONS = { addPluginConfig: false, migrateRootConfig: false, force: false };

type PluginClient = PluginInput["client"] | undefined;

interface AdvisoryState {
  emitted: boolean;
}

async function logWarn(client: PluginClient, message: string): Promise<void> {
  const log = client?.app?.log;
  if (!log) {
    console.warn(`[${PLUGIN_SERVICE_NAME}] ${message}`);
    return;
  }
  try {
    await log({ body: { service: PLUGIN_SERVICE_NAME, level: "warn", message } });
  } catch {
    console.warn(`[${PLUGIN_SERVICE_NAME}] ${message}`);
  }
}

async function showToastAdvisory(client: PluginClient, message: string): Promise<void> {
  try {
    await client?.tui?.showToast?.({
      body: {
        title: PLUGIN_SERVICE_NAME,
        message,
        variant: "warning",
        duration: ADVISORY_TOAST_DURATION_MS,
      },
    });
  } catch {
    return;
  }
}

async function emitAdvisoryOnce(state: AdvisoryState, client: PluginClient, message: string): Promise<void> {
  if (state.emitted) {
    return;
  }
  state.emitted = true;
  await logWarn(client, message);
  await showToastAdvisory(client, message);
}

async function maybeEmitInstallAdvisory(state: AdvisoryState, client: PluginClient, directory: string): Promise<void> {
  if (state.emitted || (await RegistrationDetector.hasAnyInstallation(directory))) {
    return;
  }
  await emitAdvisoryOnce(state, client, INSTALL_ADVISORY_MESSAGE);
}

async function reportLoadSkippedFiles(client: PluginClient, result: InstallResult): Promise<void> {
  for (const skippedPath of result.skipped) {
    await logWarn(
      client,
      `Skipped consumer-modified file (re-run "bunx ${PLUGIN_SERVICE_NAME} install --force" to overwrite): ${skippedPath}`
    );
  }
}

async function ensureScopeAssets(client: PluginClient, scope: Scope, directory: string): Promise<InstallResult> {
  const result = await install(scope, directory, LOAD_INSTALL_OPTIONS);
  await reportLoadSkippedFiles(client, result);
  return result;
}

const plugin: Plugin = async ({ directory, client }) => {
  const advisoryState: AdvisoryState = { emitted: false };

  return {
    config: async (_input: Config) => {
      const context = await RegistrationDetector.detect(directory);
      const scopes = RegistrationDetector.scopesToEnsure(context);

      if (scopes.length === 0) {
        await maybeEmitInstallAdvisory(advisoryState, client, directory);
        return;
      }

      for (const scope of scopes) {
        await ensureScopeAssets(client, scope, directory);
      }
    },
  };
};

export default plugin;
