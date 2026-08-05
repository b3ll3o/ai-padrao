# Architecture Decision Records

This directory captures the project-specific decisions that any AI assistant or
human contributor must respect when modifying this codebase. Each ADR is short,
Nygard-formatted, and links back to a real incident in `.harness/INCIDENTS.md`.

## How to read these

1. Skim the list below to know which ADRs exist.
2. When you are about to touch a related area, open the matching ADR.
3. The "Enforcement" section of each ADR tells you what auto-check will fail
   if you violate the rule (the harness runs the check on every build).

Each ADR has four sections: **Context**, **Decision**, **Consequences**,
**Enforcement**. Conventions: `Status: Accepted`, `Date: 2026-08-04` for all
ADRs in this initial set.

## Index (14 ADRs)

| ADR                                                          | Title                                                   | Incident | Tag                             |
| ------------------------------------------------------------ | ------------------------------------------------------- | -------- | ------------------------------- |
| [ADR-001](ADR-001-fastify-reply-api.md)                      | Use Fastify reply API, not Node ServerResponse API      | INC-002  | nestjs-fastify-gotchas          |
| [ADR-002](ADR-002-no-import-type-for-nest-di.md)             | Don't `import type` NestJS DI'd services                | INC-003  | nestjs-fastify-gotchas          |
| [ADR-003](ADR-003-public-decorator-on-health-auth.md)        | `@Public()` required on health/auth endpoints           | INC-005  | nestjs-fastify-gotchas          |
| [ADR-004](ADR-004-dockerfile-copy-schema-before-generate.md) | Dockerfile: copy prisma schema BEFORE `prisma generate` | INC-006  | pnpm-monorepo-script            |
| [ADR-005](ADR-005-non-default-ports.md)                      | Non-default host ports in `docker-compose.yml`          | INC-008  | pnpm-monorepo-script            |
| [ADR-006](ADR-006-nest-logger-not-console.md)                | Use Nest `Logger`, not `console.*` in `main.ts`         | INC-009  | nestjs-fastify-gotchas          |
| [ADR-007](ADR-007-no-skipped-tests.md)                       | Zero tolerance: no skipped/todo/`--passWithNoTests`     | INC-012  | AGENTS.md §No skipped tests     |
| [ADR-008](ADR-008-capture-scripts-bash-and-python3-only.md)  | Capture scripts use bash + python3 only                 | INC-013  | AGENTS.md §Capture deps         |
| [ADR-009](ADR-009-events-directory-is-gitignored.md)         | `.harness/events/` is gitignored (session state)        | INC-014  | AGENTS.md §Events transient     |
| [ADR-010](ADR-010-daily-digest-freshness.md)                 | Daily digest must be fresh (< 25h old)                  | INC-015  | AGENTS.md §Digest freshness     |
| [ADR-011](ADR-011-no-plaintext-secrets-in-source.md)         | No plaintext tokens in source                           | INC-016  | AGENTS.md §No plaintext secrets |
| [ADR-013](ADR-013-independent-80-percent-coverage.md)        | Independent 80% coverage per app + metric               | —        | testing                         |
| [ADR-014](ADR-014-domain-audit-foundation.md)                | Domain audit: typed history, soft-delete, versioning    | —        | api-design                      |
| [ADR-015](ADR-015-bind-mount-prisma-dir-in-api-container.md) | Bind-mount `apps/api/prisma/` into the api container    | INC-026  | docker-dev-loop                 |
| [ADR-018](ADR-018-documentation-coverage-skill.md)           | Documentation coverage is a build-time concern          | INC-028  | documentation                   |

## The three highest-traffic ADRs

If you are an AI assistant and read only three ADRs, read:

1. **ADR-007 — No skipped tests.** Triggered every time someone writes a test.
2. **ADR-002 — Don't `import type` for Nest DI.** Triggered every time someone
   refactors imports under `apps/api/`.
3. **ADR-006 — Use Nest Logger, not console.*** Triggered every time someone
   edits `apps/api/src/main.ts`.

## When to add a new ADR

After fixing a bug and adding an entry to `.harness/INCIDENTS.md`, ask: "is
this pattern likely to recur?" If yes, draft an ADR alongside the INC entry.
Add the file under `docs/decisions/`, list it in the Index table above, and
link the new INC from the ADR.
