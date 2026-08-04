# Change design: DDD/hexagonal contexts and 80% coverage

This document describes the design adopted by the change
`ddd-hexagonal-coverage`. It is the migration plan distilled from
[`docs/superpowers/specs/2026-08-04-ddd-hexagonal-and-test-coverage-design.md`](../../../../docs/superpowers/specs/2026-08-04-ddd-hexagonal-and-test-coverage-design.md)
and aligned with
[`docs/superpowers/plans/2026-08-04-ddd-hexagonal-and-test-coverage.md`](../../../../docs/superpowers/plans/2026-08-04-ddd-hexagonal-and-test-coverage.md).

## Goals

- Adopt DDD and hexagonal architecture in both `apps/api` and `apps/web`.
- Migrate existing contexts incrementally without changing public contracts.
- Enforce at least 80% statements, branches, functions, and lines independently
  in each app.
- Block forbidden imports between layers with ESLint and contract tests.

## API architecture

Each context (`users`, `auth`) will own its domain, application, inbound
adapters, and outbound adapters. The composition root lives in the Nest module.

```text
apps/api/src/contexts/<context>/
├── domain/
├── application/
├── adapters/inbound/http/
├── infrastructure/adapters/
└── <context>.module.ts
```

Domain code never imports NestJS, Fastify, Prisma, or HTTP clients. Application
use cases depend only on ports. Prisma repositories, JWT issuers, password
hashers, clocks, and external services are outbound adapters behind ports. Prisma
records are persistence models, not domain entities.

## Web architecture

The web organizes features in vertical contexts. Purely presentational code does
not require domain abstractions; behavior and invariants do.

```text
apps/web/src/features/<context>/
├── domain/
├── application/
├── adapters/presentation/
└── infrastructure/adapters/
```

Domain code never imports React, Next.js, browser APIs, or transport clients.
Forms, hooks, view models, and App Router pages are presentation adapters.
HTTP clients, cookie helpers, and navigation are infrastructure adapters behind
ports. Authentication tokens remain in httpOnly cookies; `localStorage` is
forbidden.

## Dependency direction

The allowed direction in every context is:

```text
inbound adapters ──> application ──> domain
                         │
                         v
                 outbound port interface
                         ^
                         │
              infrastructure adapter
```

The composition root can see all layers to wire dependencies. Any other
dependency direction is a forbidden action.

## Coverage policy

Each app enforces at least 80% statements, branches, functions, and lines. A
single app cannot compensate for the other. Coverage exclusions are limited to
generated code, declaration files, declarative configuration, and composition
roots with only dependency wiring. Business logic, controllers, use cases,
adapters, error branches, and domain models cannot be excluded.

The aggregate command runs both apps and fails when any metric in either app is
below 80%.

## Migration sequence

1. Open this OpenSpec change.
2. Capture honest coverage baselines without thresholds.
3. Add characterization tests for current behavior.
4. Enforce dependency direction via ESLint.
5. Build the API `users` context behind ports.
6. Migrate API `users` module to the new context and remove the legacy module.
7. Build the API `auth` ports and use cases.
8. Implement API `auth` adapters.
9. Migrate API `auth` module to the new context and remove the legacy module.
10. Migrate web `auth` to feature contexts and adapters.
11. Raise thresholds to 80% per app and add the aggregate gate.
12. Wire the aggregate gate into CI and document the architecture in
    `ARCHITECTURE.md`, `CONTRIBUTING.md`, and two proactive ADRs.
13. Archive the change.

## Compatibility guarantees

The migration MUST preserve:

- HTTP routes, methods, status codes, and response schemas.
- Cookie names and security options.
- JWT claims and TTL defaults.
- Refresh-token rotation and revocation behavior.
- Prisma schema and migrations.
- Web routes, the `middleware.ts` matcher, and visible form behavior.
- `localStorage` remains forbidden for tokens.

## Acceptance criteria

The change is complete when:

- `apps/api` and `apps/web` each report at least 80% for all four coverage
  metrics independently.
- Lint, typecheck, tests, coverage, and `pnpm harness:check` all pass.
- No source file under `apps/api/src/contexts/**/domain/` imports NestJS,
  Fastify, Prisma, or infrastructure paths.
- No source file under `apps/web/src/features/**/{domain,application}/` imports
  React, Next.js, browser APIs, or infrastructure paths.
- ARCHITECTURE.md and ADR-012/ADR-013 reflect the final structure.
- The change is archived in `.openspec/specs/architecture/`.
