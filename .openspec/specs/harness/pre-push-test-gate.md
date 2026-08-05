# Spec: Pre-push Test Gate

## Requirement

WHEN a developer runs `git push` against this repository,
THE `.githooks/pre-push` script SHALL run, in order:

  1. The cyclomatic-complexity check from `complexity-gate`.
  2. `pnpm up` (`docker compose up -d`; idempotent).
  3. A Postgres readiness wait via `pg_isready -h localhost -p 5432`
     polled every 1 s, max 30 s.
  4. `pnpm test` (turbo; unit + integration tests across all workspaces).
  5. `pnpm --filter @ai-padrao/api test:e2e` (e2e tests).

AND the script SHALL block the push (exit non-zero) if any step fails.

AND the Postgres readiness step SHALL exit 1 with a clear hint
(`docker compose logs postgres`) when Postgres does not become ready
within 30 s.

AND each step SHALL print its label and elapsed time so the developer
can identify which step failed.

AND the script SHALL depend only on bash + git + pnpm + docker +
`pg_isready`. If `pg_isready` is missing, the readiness step SHALL
degrade to a single immediate check (no retry loop) so a missing
CLI tool never blocks the developer's git workflow.

## Out of spec

- Pattern-matched test execution (running e2e only when
  `apps/api/test/**` or `apps/api/prisma/**` is in the diff).
- Coverage enforcement inside the pre-push hook.
- Per-step timeouts (the script does not impose one).
- Replacing or extending `.githooks/post-merge`.
- Bringing the docker-compose stack DOWN at any point in the hook.
