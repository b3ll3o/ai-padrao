# Proposal: Post-Merge Pull Workflow (Git Local Hook)

**Author:** Claude (acting on the user's 2026-08-05 ask)
**Date:** 2026-08-05
**Status:** Draft

## Why

After every `git pull` (or any merge that lands new commits on the current
branch), the local checkout can be in a state where:

- New dependencies were added (`pnpm-lock.yaml` changed but `node_modules` is stale)
- New INC patterns were registered in `.harness/learnings.json`
- New Prisma migrations need to be applied
- A codemod that auto-rewrites a known anti-pattern needs to run

Today, every developer has to remember the right sequence by hand. When
they forget, the next `pnpm test` red-builds, the harness inline detector
false-fires, or the build fails with `Could not find Prisma Schema` (see
[`.harness/INCIDENTS.md`](../../.harness/INCIDENTS.md) INC-006 for one
example of a class of failures that a "run after pull" hook would have
prevented).

The user asked: *"crie um workflow que deve ser executado todas as vezes
que fizem um pull."* A local Git hook that fires on `post-merge` (which
also fires after `git pull` since pull is `fetch + merge`) is the lightest
possible enforcement layer — it lives in `.git/hooks/`, is opt-out, and
runs without any CI round-trip.

## What changes

- **New script:** `.githooks/post-merge` — a bash hook that:
  1. Detects which files changed in the merge (via `git diff-tree` against the merge base).
  2. Runs the appropriate subset of validation steps based on what changed:
     - `pnpm-lock.yaml` → `pnpm install --frozen-lockfile`
     - `apps/api/prisma/**` → `pnpm db:migrate` (if a local DB is reachable)
     - `.harness/learnings.json` or `.harness/check.sh` → `pnpm harness:check`
     - anything under `apps/api/src/**` or `apps/web/src/**` → `pnpm test` (unit only, fast path)
  3. Prints a one-line summary: `[post-merge] OK in N.Ns (3 steps)` or a non-zero exit if any step failed.
- **New entry** in `package.json` `scripts`: `"postmerge:install": "git config core.hooksPath .githooks"` so a fresh clone can wire up the hook path in one command.
- **New top-level file:** `.githooks/README.md` — one paragraph explaining the hook and how to opt out (`git config --local --unset core.hooksPath`).
- **`.gitignore` entry:** no — the hook must be tracked (so a fresh clone gets it).
- **CHANGELOG entry** under `.harness/INCIDENTS.md` and `.openspec/CHANGELOG.md` describing the new layer.

## Impact

### Users

- Every developer who clones the repo runs `pnpm postmerge:install` once.
- After every `git pull` (or merge), they see a small status report in their terminal.
- They can opt out per-machine via `git config --local --unset core.hooksPath`.

### System

- Adds a new tracked file (`.githooks/post-merge`) and `scripts.postmerge:install` to `package.json`.
- Does NOT add a new top-level binary dep (bash + `git` + `pnpm` only — see INC-013 capture-dependency rule, generalized to all hooks).
- Does NOT modify any existing behavior — the hook only runs after a successful merge.

### Other features

- `.harness/capture.sh` (L1 sensor): unaffected.
- `.harness/detect.sh` (L2 guia): unaffected.
- `.harness/check.sh` (L4 enforcement): unchanged; the hook may *invoke* `pnpm harness:check` but does not modify it.

## Out of scope

- **CI-side enforcement** — the hook is local. A future proposal can add a CI-side post-merge check (e.g., a GitHub Action that runs on `push` and re-executes the same flow in a clean container).
- **Auto-fixing** — the hook only *reports* failures; it does not run codemods or fix INC patterns automatically. The user is expected to look at the failure and act.
- **Database backfills** — the `pnpm db:migrate` step is run when Prisma schema files changed, but the hook does not invoke `db:seed`. That's a separate decision the user must make explicitly.
- **Integration / e2e tests** — the post-merge hook runs the unit-test fast path only. Running the full integration + e2e suite on every pull is too slow for a synchronous hook. A separate `pnpm test:integration` / `pnpm test:e2e` command remains available on demand.

## Risks

| Risk                                                                 | Mitigation                                                                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Hook slows down `git pull` noticeably.                               | All steps are conditional on what changed. The fast path (only `pnpm-lock.yaml`) is bounded to ~10s. The slowest path (everything) ~60s.  |
| Hook fires spuriously when no real change landed (e.g., fast-forward). | The hook checks `git diff-tree` for non-empty output before running any step. A fast-forward merge to a commit already seen exits 0 silently. |
| Hook blocks the developer from committing.                            | The hook exits non-zero on failure but does not prevent the merge itself — the merge already happened. The developer can fix and `git commit` a follow-up. |
| Hook depends on `pnpm` being on PATH.                                | The hook asserts `command -v pnpm` first and prints a clear "Fix: install pnpm@9 or disable via git config --local --unset core.hooksPath" message. |
