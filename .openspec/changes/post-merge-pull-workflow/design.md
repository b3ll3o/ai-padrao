# Design: Post-Merge Pull Workflow (Git Local Hook)

Reference: `proposal.md` in this folder.

## Decisions

### 1. Local hook vs. CI hook

**Context:** The user asked for a workflow that runs on every pull. Two natural enforcement layers exist: a **local Git hook** (fires on the developer's machine after `git pull`) and a **CI hook** (fires in a clean container on `push`).

**Choice:** Local hook first, CI later (out of scope here).

**Rejected alternatives:**

- **CI-only:** Forces every developer to wait for CI to catch a problem. Adds a 30s+ round trip on every push. Does not give the developer immediate feedback while their context is fresh.
- **Both at once:** Doubles the surface area. The CI hook will need a clean environment that the local hook cannot provide (e.g., real Postgres). Defer CI to a follow-up proposal that can integrate with the project's existing CI infra.

### 2. Conditional steps vs. always-run-everything

**Context:** The full validation suite (`pnpm harness:check` + `pnpm test` + `pnpm db:migrate` + `pnpm install`) takes ~2 minutes end-to-end. Running it on every `git pull` is too slow for a synchronous hook.

**Choice:** Conditional — only run the step(s) implied by the changed file paths.

**Rejected alternatives:**

- **Always run everything:** Wastes time when only documentation changed.
- **Always run `pnpm harness:check` only (cheapest):** Misses the cases where a new dep needs `pnpm install` or a Prisma migration needs `db:migrate`.

### 3. Detection of changed files via `git diff-tree`

**Context:** Post-merge runs after a successful merge. We need the set of files that changed between the pre-merge HEAD and the new HEAD. The standard incantation is `git diff-tree --no-commit-id --name-only -r HEAD@{1} HEAD` (the `HEAD@{1}` reflog entry points at the pre-merge HEAD).

**Choice:** Use `git diff-tree`. Handle the empty case (fast-forward to a commit already seen) by exiting 0 silently.

**Rejected alternatives:**

- **`git diff --name-only HEAD~1 HEAD`:** Breaks on merge commits with more than one parent.
- **Reading the reflog manually:** Reinventing what `git diff-tree` already does.

### 4. Opt-in via `pnpm postmerge:install` (not auto-config in `pnpm install`)

**Context:** Modifying `git config` from inside `pnpm install` is a surprising side effect. The project already has a `packageManager` field and a `preinstall` script — adding hook installation there would be invasive.

**Choice:** Add a separate `scripts.postmerge:install` command that the user runs once after cloning. Document the step in the README quickstart.

**Rejected alternatives:**

- **Auto-config in `pnpm install`:** Surprising; users from CI may not want their `core.hooksPath` overridden.
- **Hard-coded `.git/hooks/post-merge`:** Would still need a copy step, and that copy step is the same surprise as the auto-config.

### 5. Hook is bash + `git` + `pnpm` only (no new binary deps)

**Context:** INC-013 (capture-script deps) taught us that adding a new top-level binary dep to a hook creates a silent-no-op risk. The post-merge hook is the same class of automation.

**Choice:** Bash + `git` + `pnpm` only. The hook asserts `command -v pnpm` and `command -v git` at startup and prints a clear opt-out message if either is missing.

**Rejected alternatives:**

- **Python (like the harness capture scripts):** Would add Python as a new dependency for *all* developers. The hook only needs to do file matching and command invocation — bash is enough.
- **`jq` for JSON parsing:** The hook does not need to parse JSON. The file-change set is plain text from `git diff-tree`.
