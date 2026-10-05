import { PackageCacheCleaner } from "../cache.ts";
import { getPackageName } from "../installer.ts";

export async function clearCacheCommand(): Promise<void> {
  await new PackageCacheCleaner(getPackageName()).prune(false);
  console.log(`Cleared cached copies of ${getPackageName()} from the opencode package cache.`);
}
