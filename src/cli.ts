#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { installCommand } from "./commands/install.ts";
import { uninstallCommand } from "./commands/uninstall.ts";
import { statusCommand } from "./commands/status.ts";
import type { Scope } from "./installer.ts";

const VERSION = JSON.parse(
  await Bun.file(`${import.meta.dirname}/../package.json`).text(),
).version;

function printHelp(): void {
  console.log(`
opencode-gemiterm-skills v${VERSION}

Commands:
  install     Copy skills to .opencode/skills/ and register in opencode.json
  uninstall   Remove installed skills from .opencode/skills/
  status      Check installation status

Options:
  -s, --scope <scope>    Installation scope: "local" (default) or "global"
  -h, --help             Show this help message
  -v, --version          Show version

Examples:
  bunx opencode-gemiterm-skills install
  bunx opencode-gemiterm-skills install --scope global
  bunx opencode-gemiterm-skills uninstall --scope local
  bunx opencode-gemiterm-skills status
`);
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    options: {
      scope: { type: "string", short: "s" },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.version) {
    console.log(`opencode-gemiterm-skills v${VERSION}`);
    process.exit(0);
  }

  if (values.help || positionals.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = positionals[0];
  const scope: Scope | undefined = values.scope as Scope | undefined;

  if (scope && scope !== "local" && scope !== "global") {
    console.error(`Invalid scope: ${scope}. Must be "local" or "global".`);
    process.exit(1);
  }

  try {
    switch (command) {
      case "install":
        await installCommand({ scope });
        break;
      case "uninstall":
        await uninstallCommand({ scope });
        break;
      case "status":
        await statusCommand();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();