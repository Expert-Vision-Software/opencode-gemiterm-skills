const PACKAGE_NAME = "opencode-gemiterm-skills";
const PACKAGE_VERSION = "0.1.0";
const BUNDLED_SKILLS = ["gemiterm", "debate-with-gemini"];
const SELF_CONFIG_PATH = ".opencode/opencode.json";

function printVersion(): void {
  console.log(`${PACKAGE_NAME} ${PACKAGE_VERSION}`);
}

function printHelp(): void {
  console.log(`${PACKAGE_NAME} - OpenCode skills bundle`);
  console.log("");
  console.log("Bundled skills:");
  for (const name of BUNDLED_SKILLS) {
    console.log(`  - ${name}`);
  }
  console.log("");
  console.log("Usage:");
  console.log(`  bunx ${PACKAGE_NAME} [version|help]`);
  console.log("");
  console.log("This package is markdown-only. Skills are loaded from");
  console.log(`assets/skills/ via ${SELF_CONFIG_PATH}.`);
}

function isVersionCommand(command: string | null): boolean {
  if (command === null) return false;
  return command === "version" || command === "--version" || command === "-v";
}

function main(): void {
  const command = process.argv[2] ?? null;
  if (isVersionCommand(command)) {
    printVersion();
    return;
  }
  printHelp();
}

main();
