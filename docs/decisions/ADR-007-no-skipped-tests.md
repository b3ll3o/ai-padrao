# ADR-007 — Zero tolerance: no skipped/todo/`--passWithNoTests` in tracked code

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-012 (full context in `.harness/INCIDENTS.md`)

## Context

Skipping tests is contagious. The first commit that adds `.skip()` to
"silence the flake" is the same commit that erases the regression test
that would have caught the next bug. CI then goes green on a brittle
suite whose true coverage is unknown, and refactors pass review because
"the tests pass." Six months later nobody dares re-enable the skipped
tests because the underlying assertion has rotted.

`vitest --passWithNoTests` is the same failure mode in a different
shape: a package with zero tests reports "passing" and breaks the
whole-repo coverage gate without anyone noticing.

## Decision

Tracked code under `apps/` and `packages/` MUST NOT contain:

- `it.skip`, `test.skip`, `describe.skip`, `context.skip`
- `xit`, `xtest`, `xdescribe`, `xtest`
- `it.todo`, `test.todo`
- `vitest.config.{ts,js}` / `jest.config.{ts,js}` with `passWithNoTests: true`
  or `coverage.skip: true` for non-excluded files
- `package.json` scripts that pass `--passWithNoTests` or `--testPathIgnorePatterns`
  that hide failing files

If a test must be temporarily disabled (a known flake under
investigation), delete the test and reference the incident in the
related ADR. Re-add the test once the fix lands. Do not leave a
graveyard of skipped tests in the repo.

## Consequences

- **Easier:** Coverage numbers are real. CI fails when a regression
  test goes missing.
- **Harder:** Genuine flakes must be fixed at the root, not silenced.
  Per-test setup time is the usual culprit.
- **Trade-off:** Accept — silent test rot is the most expensive form of
  technical debt in this codebase.

## Enforcement

- Auto-check **INC-012** in `.harness/check.sh` scans `apps/` and
  `packages/` (excluding `node_modules`, `.next`, `dist`, `.turbo`,
  `coverage`, `standalone`) for any of the patterns above and fails on
  the first hit. Output is grouped by source, runner flags, and config.
- `AGENTS.md §No skipped tests` is the human-facing rule.
- PR template requires the author to confirm "no tests were skipped,
  stubbed, or disabled" before review.
