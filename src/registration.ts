import { join } from "node:path";
import {
  CONFIG_FILE_NAMES,
  PACKAGE_NAME,
  getGlobalConfigPath,
  getLocalConfigPath,
  isConfigUnparseable,
  isPluginInConfigBase,
  isScopeInstalled,
  type Scope,
} from "./installer.ts";

export type RegistrationContext = "none" | "global" | "repo-local" | "both";

const SCOPES_BY_CONTEXT: Record<RegistrationContext, Scope[]> = {
  none: [],
  global: ["global"],
  "repo-local": ["local"],
  both: ["global", "local"],
};

export class RegistrationDetector {
  static async detect(directory: string): Promise<RegistrationContext> {
    const globalRegistered = await RegistrationDetector.checkGlobalRegistration();
    const repoLocalRegistered = await RegistrationDetector.isRegisteredInRepo(directory);

    if (globalRegistered && repoLocalRegistered) {
      return "both";
    }
    if (globalRegistered) {
      return "global";
    }
    if (repoLocalRegistered) {
      return "repo-local";
    }
    return "none";
  }

  static scopesToEnsure(context: RegistrationContext): Scope[] {
    return SCOPES_BY_CONTEXT[context];
  }

  static async hasAnyInstallation(directory: string): Promise<boolean> {
    if (await isScopeInstalled(getGlobalConfigPath())) {
      return true;
    }
    return isScopeInstalled(getLocalConfigPath(directory));
  }

  private static async checkGlobalRegistration(): Promise<boolean> {
    const configBase = getGlobalConfigPath();
    await RegistrationDetector.warnUnparseableCandidates(configBase);
    return isPluginInConfigBase(configBase, PACKAGE_NAME);
  }

  private static async isRegisteredInRepo(directory: string): Promise<boolean> {
    const nestedConfigBase = getLocalConfigPath(directory);
    await RegistrationDetector.warnUnparseableCandidates(nestedConfigBase);
    await RegistrationDetector.warnUnparseableCandidates(directory);
    const nestedRegistered = await isPluginInConfigBase(nestedConfigBase, PACKAGE_NAME);
    const rootRegistered = await isPluginInConfigBase(directory, PACKAGE_NAME);
    return nestedRegistered || rootRegistered;
  }

  private static async warnUnparseableCandidates(configBase: string): Promise<void> {
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = join(configBase, fileName);
      if (await isConfigUnparseable(configPath)) {
        RegistrationDetector.warnUnparseable(configPath);
      }
    }
  }

  private static warnUnparseable(configPath: string): void {
    console.warn(
      `[${PACKAGE_NAME}] ${configPath} is not valid JSON and was ignored during registration detection. ` +
        `Fix or remove the file; until then this scope is treated as not registered.`
    );
  }
}
