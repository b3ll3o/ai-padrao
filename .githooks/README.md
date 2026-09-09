# .githooks — Local Git Hooks

This directory holds local-only Git hooks that ship with the repo. They
are **opt-in**: a fresh clone does not run them until you wire them up.

## Install (one-time per clone)

```bash
pnpm postmerge:install
```

This sets `core.hooksPath` to `.githooks` for the local clone only. CI
runs are unaffected.

## Opt out (per-clone)

```bash
git config --local --unset core.hooksPath
```

The hooks are tracked so every clone gets the same setup experience,
but they do not auto-activate — you have to run `pnpm postmerge:install`
once.

## What's in here

| Hook             | When it fires                                | What it does                                                                          |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| `pre-push`       | Before every `git push`                      | Runs `pnpm lint`, `pnpm typecheck`, `pnpm test` and blocks the push on failure.       |
| `post-merge`     | After every successful merge (incl. `pull`)  | Runs `pnpm install --frozen-lockfile` when `pnpm-lock.yaml` changed.                  |

## Adding a new hook

1. Write the hook script in this directory.
2. Update the table above.
3. Open an OpenSpec change at `.openspec/changes/<feature>/` describing
   the new hook's behavior.
4. Add the new hook to the `core.hooksPath` setup (no per-hook install
   step needed — the directory is wired up as a whole).

## Why a separate directory, not `.git/hooks/`

`.git/hooks/` is per-clone and not tracked. Putting hooks in `.githooks/`
keeps them under version control while still being opt-in via
`core.hooksPath`.
