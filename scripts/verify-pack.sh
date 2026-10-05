#!/usr/bin/env bash
set -euo pipefail

required=(
  "index.ts"
  "src/plugin.ts"
  "src/installer.ts"
  "src/cli.ts"
  "skills/gemiterm/SKILL.md"
  "skills/debate-with-gemini/SKILL.md"
)

listing="$(npm pack --dry-run 2>&1)"

missing=0
for entry in "${required[@]}"; do
  if ! grep -qF "$entry" <<<"$listing"; then
    echo "Missing from tarball: $entry" >&2
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "npm pack verification failed" >&2
  exit 1
fi

echo "npm pack verification passed"
