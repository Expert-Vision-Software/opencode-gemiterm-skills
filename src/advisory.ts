import type { PluginInput } from "@opencode-ai/plugin";
import type { InstallResult } from "./installer.ts";
import { PACKAGE_NAME, getPackageVersion } from "./installer.ts";
import { RegistrationDetector } from "./registration.ts";

const ADVISORY_TOAST_DURATION_MS = 10000;
const INSTALL_ADVISORY_MESSAGE = `${PACKAGE_NAME} is not installed in any scope. Run "bunx ${PACKAGE_NAME} install --scope global" to enable the gemiterm and debate-with-gemini skills.`;

export interface AdvisoryContext {
  client: PluginInput["client"] | undefined;
  directory: string;
  emitted: boolean;
}

export function createAdvisoryContext(
  client: PluginInput["client"] | undefined,
  directory: string,
): AdvisoryContext {
  return { client, directory, emitted: false };
}

async function logWarn(context: AdvisoryContext, message: string): Promise<void> {
  const log = context.client?.app?.log;
  if (!log) {
    console.warn(`[${PACKAGE_NAME}] ${message}`);
    return;
  }
  try {
    await log({ body: { service: PACKAGE_NAME, level: "warn", message } });
  } catch {
    console.warn(`[${PACKAGE_NAME}] ${message}`);
  }
}

async function showToastAdvisory(context: AdvisoryContext, message: string): Promise<void> {
  try {
    await context.client?.tui?.showToast?.({
      body: {
        title: PACKAGE_NAME,
        message,
        variant: "warning",
        duration: ADVISORY_TOAST_DURATION_MS,
      },
    });
  } catch {
    return;
  }
}

async function emitAdvisoryOnce(context: AdvisoryContext, message: string): Promise<void> {
  if (context.emitted) {
    return;
  }
  context.emitted = true;
  await logWarn(context, message);
  await showToastAdvisory(context, message);
}

export async function maybeEmitInstallAdvisory(context: AdvisoryContext): Promise<void> {
  if (context.emitted || (await RegistrationDetector.hasAnyInstallation(context.directory))) {
    return;
  }
  await emitAdvisoryOnce(context, INSTALL_ADVISORY_MESSAGE);
}

export async function emitFailureAdvisory(context: AdvisoryContext, error: unknown): Promise<void> {
  let message: string;
  try {
    message = await buildFailureMessage(error);
  } catch {
    message =
      `${PACKAGE_NAME} startup self-ensure failed and the package metadata is unreadable. ` +
      `Remedies: run "bunx ${PACKAGE_NAME} install --scope global", or clear the plugin cache ` +
      `under ~/.cache/opencode/packages/ and restart.`;
  }
  await logWarn(context, message);
  await showToastAdvisory(context, message);
}

async function buildFailureMessage(error: unknown): Promise<string> {
  const detail = error instanceof Error ? error.message : String(error);
  const cacheDir = `~/.cache/opencode/packages/${PACKAGE_NAME}@${await getPackageVersion()}`;
  return (
    `${PACKAGE_NAME} startup self-ensure failed: ${detail}. Remedies: run ` +
    `"bunx ${PACKAGE_NAME} install --scope global", or, if the OpenCode plugin cache is corrupt, ` +
    `remove the cached copy and restart: "rm -rf ${cacheDir}".`
  );
}

export async function reportLoadSkippedFiles(
  context: AdvisoryContext,
  result: InstallResult,
): Promise<void> {
  for (const skippedPath of result.skipped) {
    await logWarn(
      context,
      `Skipped consumer-modified file (re-run "bunx ${PACKAGE_NAME} install --force" to overwrite): ${skippedPath}`
    );
  }
}
