import { exists, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export class PackageCacheCleaner {
  private readonly packageName: string;

  constructor(packageName: string) {
    this.packageName = packageName;
  }

  async prune(keepRunningCopy: boolean): Promise<string[]> {
    try {
      const base = this.cacheBase();
      if (!(await exists(base))) {
        return [];
      }
      const removed: string[] = [];
      for (const entry of await readdir(base, { withFileTypes: true })) {
        if (!this.isOwnCacheDir(entry.name)) {
          continue;
        }
        const target = join(base, entry.name);
        if (keepRunningCopy && this.isRunningFrom(target)) {
          continue;
        }
        await rm(target, { recursive: true, force: true });
        removed.push(target);
      }
      return removed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${this.packageName}] Cache prune skipped: ${message}`);
      return [];
    }
  }

  private cacheBase(): string {
    const xdgCache = process.env.XDG_CACHE_HOME;
    if (xdgCache) {
      return join(xdgCache, "opencode", "packages");
    }
    return join(homedir(), ".cache", "opencode", "packages");
  }

  private isOwnCacheDir(name: string): boolean {
    return name === this.packageName || name.startsWith(`${this.packageName}@`);
  }

  private isRunningFrom(dir: string): boolean {
    const runningDir = import.meta.dir;
    return runningDir === dir || runningDir.startsWith(dir + "/");
  }
}
