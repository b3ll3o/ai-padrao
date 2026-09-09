# Architecture Decision Records

This directory captures the project-specific decisions that any AI assistant or
human contributor must respect when modifying this codebase. Each ADR is short,
Nygard-formatted, and documents a real decision (often triggered by a real
defect or trade-off study).

## How to read these

1. Skim the list below to know which ADRs exist.
2. When you are about to touch a related area, open the matching ADR.
3. The "Enforcement" section of each ADR tells you what code review or CI
   check will fail if you violate the rule.

Each ADR has four sections: **Context**, **Decision**, **Consequences**,
**Enforcement**. Conventions: `Status: Accepted`, `Date: 2026-08-04` for all
ADRs in this initial set.

## Index (11 ADRs)

| ADR                                                          | Title                                                   | Tag                             |
| ------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------- |
| [ADR-001](ADR-001-fastify-reply-api.md)                      | Use Fastify reply API, not Node ServerResponse API      | nestjs-fastify-gotchas          |
| [ADR-002](ADR-002-no-import-type-for-nest-di.md)             | Don't `import type` NestJS DI'd services                | nestjs-fastify-gotchas          |
| [ADR-003](ADR-003-public-decorator-on-health-auth.md)        | `@Public()` required on health/auth endpoints           | nestjs-fastify-gotchas          |
| [ADR-004](ADR-004-dockerfile-copy-schema-before-generate.md) | Dockerfile: copy prisma schema BEFORE `prisma generate` | pnpm-monorepo-script            |
| [ADR-005](ADR-005-non-default-ports.md)                      | Non-default host ports in `docker-compose.yml`          | pnpm-monorepo-script            |
| [ADR-006](ADR-006-nest-logger-not-console.md)                | Use Nest `Logger`, not `console.*` in `main.ts`         | nestjs-fastify-gotchas          |
| [ADR-007](ADR-007-no-skipped-tests.md)                       | Zero tolerance: no skipped/todo/`--passWithNoTests`     | AGENTS.md §No skipped tests     |
| [ADR-011](ADR-011-no-plaintext-secrets-in-source.md)         | No plaintext tokens in source                           | AGENTS.md §No plaintext secrets |
| [ADR-012](ADR-012-vertical-bounded-contexts.md)               | Vertical bounded contexts (DDD-hexagonal)               | ddd-hexagonal                   |
| [ADR-013](ADR-013-independent-80-percent-coverage.md)        | Independent 80% coverage per app + metric               | testing                         |
| [ADR-014](ADR-014-domain-audit-foundation.md)                | Domain audit: typed history, soft-delete, versioning    | api-design                      |
| [ADR-015](ADR-015-bind-mount-prisma-dir-in-api-container.md) | Bind-mount `apps/api/prisma/` into the api container    | docker-dev-loop                 |

## The three highest-traffic ADRs

If you are an AI assistant and read only three ADRs, read:

1. **ADR-007 — No skipped tests.** Triggered every time someone writes a test.
2. **ADR-002 — Don't `import type` for Nest DI.** Triggered every time someone
   refactors imports under `apps/api/`.
3. **ADR-006 — Use Nest Logger, not console.*** Triggered every time someone
   edits `apps/api/src/main.ts`.

## When to add a new ADR

When you encounter a recurring pattern, a non-obvious trade-off, or a defect
that's likely to recur, draft an ADR. Add the file under `docs/decisions/`,
list it in the Index table above, and link the affected code via `@remarks` in
JSDoc.
