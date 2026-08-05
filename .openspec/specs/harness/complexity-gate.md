# Spec: Complexity Gate

## Requirement

WHEN a developer commits or pushes code under `apps/*` or `packages/*`,
THE system SHALL fail the build AND fail `git push` locally IF any
function exceeds cyclomatic complexity 10.

AND the rule SHALL be enforced by ESLint's built-in `complexity` rule.

AND the threshold SHALL be configurable via the ESLint config in
`packages/config-eslint/base.js`.

AND `pnpm harness:check` SHALL include a check (INC-027) that asserts
the rule is currently passing across `apps/*` and `packages/*`.

NOTE: the original proposal referenced "INC-019" but INC-019..INC-022
are reserved slots in the L2 detector's sub-check labeling (see the
INC-018 block in `.harness/check.sh`); the next free incident number
is INC-027. This spec uses INC-027 as the canonical identifier.

AND `.githooks/pre-push` SHALL run the same ESLint complexity check
and block the push on any violation.

AND the rule SHALL apply to all `.ts` and `.tsx` files in scope,
including test files.

## Out of spec

- Cognitive complexity scoring is not in scope.
- Per-app or per-package threshold overrides are not in scope.
- Auto-refactor tooling for violations is not in scope.
