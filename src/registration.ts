import { join } from "node:path";
import {
  PACKAGE_NAME,
  getGlobalConfigPath,
  getLocalConfigPath,
  getPackageDir,
  isConfigUnparseable,
  isPluginInConfig,
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

    const isSelfCheckout = join(directory) === join(getPackageDir());
    const repoLocalRegistered = isSelfCheckout ||
      await RegistrationDetector.isRegisteredInRepo(directory);

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
    const configPath = join(getGlobalConfigPath(), "opencode.json");
    if (await isConfigUnparseable(configPath)) {
      RegistrationDetector.warnUnparseable(configPath);
      return false;
    }
    return isPluginInConfig(configPath);
  }

  private static async isRegisteredInRepo(directory: string): Promise<boolean> {
    const nestedConfigPath = join(getLocalConfigPath(directory), "opencode.json");
    if (await isConfigUnparseable(nestedConfigPath)) {
      RegistrationDetector.warnUnparseable(nestedConfigPath);
    } else if (await isPluginInConfig(nestedConfigPath)) {
      return true;
    }
    const rootConfigPath = join(directory, "opencode.json");
    if (await isConfigUnparseable(rootConfigPath)) {
      RegistrationDetector.warnUnparseable(rootConfigPath);
      return false;
    }
    return isPluginInConfig(rootConfigPath);
  }

  private static warnUnparseable(configPath: string): void {
    console.warn(
      `[${PACKAGE_NAME}] ${configPath} is not valid JSON and was ignored during registration detection. ` +
        `Fix or remove the file; until then this scope is treated as not registered.`
    );
  }
}
