---
name: setup-npm
description: Set up a GitHub Actions workflow that auto-publishes an npm package when a `v*` tag is pushed. Use when adding CI/CD publishing to an existing project, creating a release.yml workflow, troubleshooting a failed npm publish (403/404/E422), configuring NPM_TOKEN secrets, or recovering from a broken release/tag. Covers the full workflow YAML, required permissions block, npm auth via ~/.npmrc, repository URL case-sensitivity, and the tag-reset retry procedure. Trigger keywords: npm publish, release workflow, github actions npm, NPM_TOKEN, 404 not in this registry, E422 provenance, softprops action-gh-release, npm pkg fix, v-tag.
license: MIT
compatibility: opencode
metadata:
  tool: github-actions
  workflow: release
---

# Setup: Auto-Publish npm Package via GitHub Actions

End-to-end procedure for wiring a project to publish to the public npm registry on every `v*` tag push. The only variable input is the target GitHub repository (`<owner>/<repo>`) — everything else is templated.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `{{TARGET_REPO}}` | Yes | GitHub repo in `owner/repo` form, e.g. `Expert-Vision-Software/my-package` |
| `{{PACKAGE_NAME}}` | Yes | Name from `package.json` (unscoped or `@scope/name`) |
| `{{PUBLISH_COMMAND}}` | No | Defaults to `npm publish --provenance --access public`. Override for `bun publish`, `pnpm publish`, etc. |
| `{{BUN_REQUIRED}}` | No | `true` (default) or `false`. If `false`, swap `oven-sh/setup-bun` for `actions/setup-node`. |

The **target repository determines the casing of every URL** in `package.json`. GitHub repo names are case-sensitive in provenance verification — `Expert-Vision-Software/my-package` ≠ `expert-vision-software/my-package`.

## Step 1 — Verify and fix `package.json`

The publish step is case-sensitive about `repository.url`. It must match the actual GitHub repo URL byte-for-byte (including case) or provenance verification fails with E422.

Check each field matches the exact casing of `{{TARGET_REPO}}`:

```json
{
  "name": "{{PACKAGE_NAME}}",
  "version": "0.1.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/{{TARGET_REPO}}.git"
  },
  "homepage": "https://github.com/{{TARGET_REPO}}#readme",
  "bugs": {
    "url": "https://github.com/{{TARGET_REPO}}/issues"
  },
  "publishConfig": { "access": "public" }
}
```

After writing, run `npm pkg fix` once locally to auto-correct any shape warnings (bin script name cleaning, repository URL normalization). Commit the result.

## Step 2 — Create the workflow file

Write `.github/workflows/release.yml` with this exact template. The `permissions:` block and `~/.npmrc` auth pattern are the load-bearing pieces — do not simplify them.

```yaml
name: Release

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:
    inputs:
      version:
        description: "Version to release (e.g. v1.2.0)"
        required: true
        type: string
      ref:
        description: "Git ref to tag (commit SHA, branch name, or tag)"
        required: true
        type: string

concurrency:
  group: release
  cancel-in-progress: true

# Required: grants the workflow token contents: write so
# softprops/action-gh-release can create the GitHub release.
# Some orgs enforce "Read repository contents and packages permissions"
# at the org level — if so, ask the org admin to switch to
# "Read and write permissions" in Settings → Actions → General.
permissions:
  contents: write

jobs:
  release:
    name: Create GitHub Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        if: github.event_name == 'push'
        uses: actions/checkout@v4

      - name: Checkout at ref
        if: github.event_name == 'workflow_dispatch'
        uses: actions/checkout@v4
        with:
          ref: ${{ inputs.ref }}

      - name: Parse version
        id: parse-version
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            VERSION="${{ inputs.version }}"
          else
            VERSION="${GITHUB_REF#refs/tags/}"
          fi
          echo "version=$VERSION" >> $GITHUB_OUTPUT

      - name: Extract release notes from CHANGELOG.md
        id: notes
        run: |
          node -e "
            const version = '${{ steps.parse-version.outputs.version }}'.replace(/^v/, '');
            const fs = require('fs');
            const content = fs.readFileSync('CHANGELOG.md', 'utf8');
            const sections = content.split(/(?=^## )/m);
            let found = false;
            let notes = '';
            for (const section of sections) {
              const m = section.match(/^## \[([^\]]+)\].*?-\s*(\d{4}-\d{2}-\d{2})/s);
              if (m && m[1].replace(/^v/, '') === version) {
                notes = section.replace(/^## \[[^\]]+\].*?-\s*\d{4}-\d{2}-\d{2}\n/, '').trim();
                found = true;
                break;
              }
            }
            if (!found) { console.error('No changelog section for', version); process.exit(1); }
            fs.writeFileSync('RELEASE_NOTES.md', notes);
          "

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.parse-version.outputs.version }}
          name: ${{ steps.parse-version.outputs.version }}
          body_path: RELEASE_NOTES.md
          draft: false
          prerelease: ${{ contains(steps.parse-version.outputs.version, '-') }}
          generate_release_notes: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  publish:
    name: Publish to npm
    runs-on: ubuntu-latest
    needs: release
    # Only run on real tag pushes — workflow_dispatch has no tag.
    if: github.event_name == 'push'
    # id-token: write is required for --provenance (OIDC attestations).
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        if: {{BUN_REQUIRED}} != 'false'
        uses: oven-sh/setup-bun@v2

      - name: Setup Node
        if: {{BUN_REQUIRED}} == 'false'
        uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org

      - name: Install dependencies
        if: {{BUN_REQUIRED}} != 'false'
        run: bun install
      - name: Install dependencies
        if: {{BUN_REQUIRED}} == 'false'
        run: npm ci

      - name: Validate prepublish checks
        run: |
          {{ 'bun run check' if BUN_REQUIRED != 'false' else 'npm run check --if-present' }}
          {{ 'bun test' if BUN_REQUIRED != 'false' else 'npm test --if-present' }}

      - name: Publish to npm
        run: |
          # Write the auth token to ~/.npmrc. This is the only auth form
          # that works reliably with both classic and org-scoped NPM_TOKEN
          # secrets in GitHub Actions.
          echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
          {{PUBLISH_COMMAND}}
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Commit and push the workflow before tagging — the tag is what triggers it.

## Step 3 — Configure the NPM_TOKEN secret

Two places to put it. Pick one:

### A. Repository secret (most projects)

Settings → Secrets and variables → Actions → **New repository secret**:
- **Name:** `NPM_TOKEN`
- **Value:** the npm token

### B. Organization secret (shared across org repos)

Org Settings → Secrets and variables → Actions → **New organization secret**:
- Same name/value
- Set **Repository access** to "All repositories" or pick specific ones

### Token source

Create the token at <https://www.npmjs.com/settings/YOUR-USER/tokens>:

- **Classic token, type = Publish** — works for any package the user owns/publishes
- **Granular token** — scope to specific package names and the "Publish packages" permission; preferred for new projects

> **Important:** Classic tokens expire (90 days by default). Granular tokens have a configurable expiry. The GitHub secret does **not** auto-rotate; you must regenerate the npm token, then re-paste it into the GitHub secret.

> **If 2FA is enabled on the npm account** and the token is publish-scoped, npm may still require OTP for first-time publishes of a new package name. In CI, use a **granular token with 2FA bypass for publish** configured under the token's settings, or disable 2FA for the user.

## Step 4 — Trigger the first release

The workflow triggers on any tag matching `v*`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Watch the run: `https://github.com/{{TARGET_REPO}}/actions`.

Both jobs must succeed:
1. `Create GitHub Release` — creates the GitHub release from `CHANGELOG.md`
2. `Publish to npm` — packs the tarball, signs provenance, PUTs to npm

## Step 5 — Reset and retry (when something goes wrong)

When a release fails, the broken state lingers on both ends. The release exists, the tag exists, and you cannot simply re-push the same tag. The full reset:

```bash
# 1. Delete the GitHub release (via gh CLI).
gh release delete v0.1.0 --yes

# 2. Delete the remote tag.
git push origin :refs/tags/v0.1.0

# 3. Delete the local tag (if any).
git tag -d v0.1.0

# 4. Fix the underlying cause (see Troubleshooting).

# 5. Re-create the tag on the fixed commit and push.
git tag v0.1.0
git push origin v0.1.0
```

If the version was already published to npm, **bump the version** in `package.json` and the changelog before re-tagging. npm rejects duplicate version publishes with 409.

## Troubleshooting

### `403 Resource not accessible by integration` (release job)

`softprops/action-gh-release` failed to create the release. The default `GITHUB_TOKEN` is read-only.

**Fix:** ensure the workflow has `permissions: contents: write` (Step 2). If the org enforces "Read repository contents and packages permissions" at the org level, the only way past it is either switching the org setting to "Read and write permissions", or using a fine-grained PAT in a separate secret — but the workflow-level `permissions:` block is enough for the common case.

### `404 Not Found - PUT https://registry.npmjs.org/<name>` (publish job)

The package name lookup returned 404. This is **not** a normal "package doesn't exist" case — npm is supposed to create it on PUT. Two real causes:

1. **Token expired or revoked.** Generate a new one at npmjs.com → Tokens, then re-paste it into the GitHub `NPM_TOKEN` secret. (This is the most common cause.)
2. **Token is org-scoped and the package is unscoped** (or vice versa). An `@scope/package` token can't publish unscoped packages and vice versa. Match the package's scope to the token's scope, or use a non-scoped classic token.

### `404 'opencode-gemiterm-skills@0.5.0' is not in this registry`

Same as above — a token or scope mismatch. The error message is misleading; the real problem is auth, not registry state.

### `422 Error verifying sigstore provenance bundle: Failed to validate repository information`

`package.json#repository.url` does not match the GitHub repo URL byte-for-byte. Common mistakes:

- Lowercase owner in `repository.url` but the GitHub org is `Expert-Vision-Software` (mixed case).
- Trailing `.git` mismatch.
- `git+` prefix mismatch (npm normalizes this; either is fine in `repository.url`, but consistency matters).

**Fix:** update all three of `repository.url`, `homepage`, `bugs.url` to use the **exact** case of the GitHub org/repo. Run `npm pkg fix` to see what npm will normalize to.

### `npm warn publish "repository.url" was normalized to "git+https://..."`

npm added the `git+` prefix on its own. This is fine, but if the provenance verifier expects a different format, the E422 error above will surface.

### `actions/checkout@v4` Node.js 20 deprecation warning

Warning only, not a failure. The action still runs. To silence: upgrade to `actions/checkout@v5` when available, or set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` as a workflow env var.

## Checklists

### First-time setup

- [ ] `package.json` has `repository.url`, `homepage`, `bugs.url` with correct case
- [ ] `CHANGELOG.md` has a `## [0.1.0] - YYYY-MM-DD` section
- [ ] `.github/workflows/release.yml` exists with `permissions: contents: write`
- [ ] `NPM_TOKEN` secret is set at repo or org level
- [ ] Working tree is committed and pushed
- [ ] `git tag v0.1.0 && git push origin v0.1.0` triggers both jobs green

### Resetting a failed release

- [ ] `gh release delete vX.Y.Z --yes`
- [ ] `git push origin :refs/tags/vX.Y.Z`
- [ ] `git tag -d vX.Y.Z`
- [ ] Fix the root cause (most often: token expiry, or URL case)
- [ ] Bump version in `package.json` if it was already published
- [ ] `git tag vX.Y.Z && git push origin vX.Y.Z`
