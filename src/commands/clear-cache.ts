import { PackageCacheCleaner } from "../cache.ts";
import { getPackageName } from "../installer.ts";

export async function clearCacheCommand(): Promise<void> {
  const packageName = getPackageName();
  const removed = await new PackageCacheCleaner(packageName).prune(false);
  if (removed.length === 0) {
    console.log(`Nothing to clear: no cached copies of ${packageName} were found in the opencode package cache.`);
    return;
  }
  console.log(`Removed ${removed.length} cached cop${removed.length === 1 ? "y" : "ies"} of ${packageName} from the opencode package cache:`);
  for (const path of removed) {
    console.log(`  ${path}`);
  }
}
