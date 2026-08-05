# ADR-013: Independent 80% coverage gate per app and per metric

- **Status:** Accepted
- **Date:** 2026-08-04
- **Decision type:** Proactive architecture decision
- **Related ADRs:** [ADR-012](./ADR-012-vertical-bounded-contexts.md)

## Context

Before this ADR, coverage reporting was an opt-in per-app baseline. There
was no enforced threshold and no per-metric breakdown. That created two
recurring failure modes:

1. **Silent undercoverage.** A refactor that removed tests could ship green
   as long as the suite passed. "Coverage" was a number in a report no one
   read.
2. **Averaging hides holes.** A combined "monorepo coverage" report could
   report 85% lines while one app sat at 60% — the weak link was masked by
   the strong one.

Both apps also need **independent** gates: a feature added to `apps/web`
should not be able to "pay for" coverage debt in `apps/api`, and vice
versa. Cross-app averaging would let a healthy app subsidize a neglected
one.

## Decision

Coverage is enforced **independently** per app and per metric:

- Each app configures its own Jest/Vitest coverage with explicit
  thresholds:
  - `apps/api/jest.config.ts` — `coverageThreshold.global` = `{ statements:
80, branches: 80, functions: 80, lines: 80 }`, with an explicit
    `collectCoverageFrom` list that excludes specs and `*.module.ts`
    composition files.
  - `apps/web/vitest.config.ts` — `coverage.thresholds` = `{ statements:
80, branches: 80, functions: 80, lines: 80 }`, with `provider: "v8"`
    and an explicit `include`/`exclude` list (excludes `*.spec.{ts,tsx}`,
    `app/layout.tsx`, `app/providers.tsx`).
- A single root command, `pnpm test:coverage`, runs each app's coverage
  gate in sequence. It fails if **any one metric in any one app** drops
  below 80%.
- CI (`.github/workflows/ci.yml`) runs `pnpm test:coverage` once, after
  `pnpm test` and before `pnpm build`. The gate is **not** re-run from
  `prebuild` to avoid duplicate work in the same pipeline — `prebuild`
  runs `pnpm harness:check`, which is deliberately separate.
- Each app's `package.json` exposes its own `test:coverage` script for
  local debugging (e.g. `pnpm --filter @ai-padrao/api test:coverage`).

The four metrics — statements, branches, functions, lines — are enforced
separately. Lowering a threshold, excluding business code, adding
`coverage-ignore` directives, or writing meaningless tests to satisfy the
gate are forbidden.

## Consequences

Positive:

- A coverage regression cannot ship green on either app. The gate fails
  the build with the exact metric and file the runner reports.
- The "healthy app subsidizes the neglected app" failure mode is
  structurally impossible — the gate is per-app, per-metric.
- Local iteration is fast: engineers run `pnpm --filter <app>
test:coverage` to debug a single app without booting both.
- CI is honest about the gate. There is one source of truth
  (`pnpm test:coverage`), so test thresholds cannot drift between local
  and CI.

Negative / trade-offs:

- New code MUST come with tests, or the gate fails. This is intentional,
  but it raises the floor for "tiny" changes — see ADR-012 for the
  pragmatic-DDD caveat that keeps purely declarative surfaces exempt from
  contrived domain abstractions.
- Vitest and Jest report thresholds slightly differently (e.g. v8's branch
  metric vs Jest's `branches`). The 80% floor is generous enough that
  minor metric-mismatch noise does not cause false negatives, but the
  per-app configs are version-locked in `pnpm-lock.yaml` and must move
  together.
- The gate enforces a number, not a quality. A meaningless test still
  raises coverage. This is mitigated by the no-skipped-tests harness
  check (`INC-012`) and by code review — the gate is necessary but not
  sufficient.

## Enforcement

- `apps/api/jest.config.ts` and `apps/web/vitest.config.ts` declare the
  thresholds. Both runners fail the build if any threshold is unmet.
- `pnpm test:coverage` at the repo root runs both apps in sequence.
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs
  `pnpm harness:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm test:coverage`, then `pnpm build` in that order. Coverage is the
  last gate before `pnpm build`.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) lists `pnpm test:coverage` in
  the validation commands and states the four 80% thresholds per app in
  the Definition of Done.
- `AGENTS.md` global rules forbid lowering the thresholds, excluding
  business code, adding coverage-ignore directives, or writing
  meaningless tests.
