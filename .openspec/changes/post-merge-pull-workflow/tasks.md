# Tasks: Post-Merge Pull Workflow (Git Local Hook)

Reference: `proposal.md` in this folder.

- [ ] 1. Create `.githooks/` directory and `.githooks/README.md`
      DoD: `cat .githooks/README.md` shows the opt-in/opt-out instructions.

- [ ] 2. Implement `.githooks/post-merge` bash script
      DoD:
      - Shebang `#!/usr/bin/env bash`; `set -euo pipefail`; resolves repo root via `git rev-parse --show-toplevel`.
      - Computes changed files via `git diff-tree --no-commit-id --name-only -r HEAD@{1} HEAD` (handles fast-forward and merge).
      - Branches on changed paths: `pnpm-lock.yaml` → `pnpm install --frozen-lockfile`; `apps/api/prisma/**` → `pnpm db:migrate`; `.harness/**` → `pnpm harness:check`; runtime source → `pnpm test`.
      - Asserts `command -v pnpm` before running; prints clear error if missing.
      - Prints a one-line `[post-merge] OK in N.Ns (N steps)` summary on success, or `[post-merge] FAIL at step X: …` on failure.
      - Exits 0 on success, non-zero on any step failure (without blocking the merge itself, which already happened).

- [ ] 3. Add `scripts.postmerge:install` to `package.json`
      DoD: `pnpm postmerge:install` exists, sets `core.hooksPath` to `.githooks`, and `git config --get core.hooksPath` returns `.githooks` after running.

- [ ] 4. Add the hook as a one-time pre-existing-installation step in the README quickstart
      DoD: `README.md` (or `AGENTS.md`) quickstart section includes `pnpm postmerge:install` as step 3 after `pnpm install`.

- [ ] 5. Manual end-to-end test
      DoD:
      - `pnpm postmerge:install` in a fresh clone → `git config --get core.hooksPath` returns `.githooks`.
      - Touch `pnpm-lock.yaml` (no other change), commit, then run `git -c core.hooksPath=.githooks pull` against a synthetic upstream branch → hook fires the `pnpm install` step only.
      - Touch `.harness/learnings.json` only, commit, run the synthetic pull → hook fires the `harness:check` step only.
      - Touch runtime source, commit, run the synthetic pull → hook fires the `pnpm test` step only.
      - All three scenarios print the success summary.

- [ ] 6. Commit each task as a separate Conventional Commit
      DoD: 5 commits with `chore(root):` (or `feat(root):` for the first one) and proper scope; commit body references the task number.

- [ ] 7. After PR merge, archive the change
      DoD:
      - `mv .openspec/changes/post-merge-pull-workflow/specs/harness/spec.md .openspec/specs/harness/post-merge-pull-workflow.md`
      - Append to `.openspec/CHANGELOG.md`: `2026-08-05 — post-merge-pull-workflow — added .githooks/post-merge hook + pnpm postmerge:install`
      - Delete `.openspec/changes/post-merge-pull-workflow/` (the rest of the folder).
