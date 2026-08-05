# Spec: harness — Post-Merge Pull Workflow

This spec describes the behavior of the `.githooks/post-merge` hook after
the change is implemented. The hook runs on the developer's local machine
after every successful merge (including `git pull`).

## Requirements

The keywords **SHALL**, **SHOULD**, and **MAY** follow RFC 2119.

### Hook installation

- THE repository SHALL ship a tracked `.githooks/post-merge` file and a `scripts.postmerge:install` entry in `package.json`.
- WHEN a developer runs `pnpm postmerge:install` for the first time, THE system SHALL set `core.hooksPath` to `.githooks` for the local clone.
- WHEN a developer wants to opt out, THE system SHALL accept `git config --local --unset core.hooksPath` and re-disable the hook.

### Hook execution

- WHEN a merge completes successfully (including `git pull` which is `fetch + merge`), THE post-merge hook SHALL run.
- THE hook SHALL resolve the repo root via `git rev-parse --show-toplevel` and `cd` into it before any other command.
- THE hook SHALL compute the set of changed file paths via `git diff-tree --no-commit-id --name-only -r HEAD@{1} HEAD`.
- WHEN the changed-file set is empty (e.g., fast-forward to a known commit), THE hook SHALL exit 0 silently with no output.

### Conditional step selection

- WHEN `pnpm-lock.yaml` is in the changed-file set, THE hook SHALL run `pnpm install --frozen-lockfile`.
- WHEN any path matching `apps/api/prisma/**` is in the changed-file set, THE hook SHOULD run `pnpm db:migrate`. (Migrations may fail if the local DB is not reachable; the hook SHALL print the failure and exit non-zero so the developer notices.)
- WHEN any path matching `.harness/**` is in the changed-file set, THE hook SHALL run `pnpm harness:check`.
- WHEN any path matching `apps/api/src/**`, `apps/web/src/**`, or `packages/**/src/**` is in the changed-file set, THE hook SHALL run `pnpm test -- --run --reporter=basic` (unit tests only, fast path).
- THE hook MAY run multiple steps in sequence when multiple conditions are met (e.g., a Prisma migration AND a runtime source change both land).

### Output and exit codes

- THE hook SHALL print a one-line summary on success: `[post-merge] OK in N.Ns (N steps)` where N is the number of steps that actually ran.
- WHEN any step exits non-zero, THE hook SHALL print `[post-merge] FAIL at step X: <command>` followed by the step's stderr, and exit non-zero.
- THE hook SHALL NOT attempt to undo the merge — the merge already happened. The non-zero exit only signals to the developer that follow-up action is required.

### Required toolchain

- THE hook SHALL assert `command -v git` and `command -v pnpm` before running any step. WHEN either is missing, THE hook SHALL print a clear opt-out message (`"Fix: install pnpm@9 or disable via git config --local --unset core.hooksPath"`) and exit 0 (so the developer can still use Git without the hook).

## Examples

### Lockfile-only change

```
$ git pull
[post-merge] OK in 8.4s (1 steps)
```

### Schema + harness change

```
$ git pull
[harness] ========================================
  ai-padrao harness auto-checks
  Source: .harness/learnings.json
========================================
... (15 PASS, 0 FAIL) ...
[post-merge] OK in 12.1s (2 steps)
```

### Test failure

```
$ git pull
... (test output) ...
[post-merge] FAIL at step 2: pnpm test
  Expected tests to pass. 3 failed.
[post-merge] Follow up: fix the failing tests and `git commit --amend`.
```

### Hook not installed

```
$ git pull
# no [post-merge] line — hook not active
$ pnpm postmerge:install
# sets core.hooksPath to .githooks
$ git pull
[post-merge] OK in 0.0s (0 steps)
```
