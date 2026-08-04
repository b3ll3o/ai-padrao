# API Rules — DDD and Hexagonal Architecture

This file extends the repository-wide rules in [`../../AGENTS.md`](../../AGENTS.md).
The root rules remain authoritative. These rules apply to every file under
`apps/api/`.

## Required architecture

The API MUST follow Domain-Driven Design (DDD) and hexagonal architecture. New
business capabilities MUST be implemented as vertical bounded contexts. Existing
contexts migrate incrementally; a migration must keep external contracts stable
unless an approved OpenSpec delta explicitly changes them.

A context SHOULD use this shape:

```text
<context>/
├── domain/
├── application/
├── adapters/
│   └── inbound/
├── infrastructure/
│   └── adapters/
└── <context>.module.ts
```

Use DDD pragmatically. Create entities, value objects, aggregates, domain
services, and domain events only when they represent real behavior or
invariants. Do not add abstractions that only rename framework or database
operations.

## Dependency rules

Dependencies MUST point inward:

```text
inbound adapters -> application -> domain
infrastructure adapters -> application/domain ports
composition root -> all layers
```

- `domain/` MUST NOT import NestJS, Fastify, Prisma, database clients, HTTP
  libraries, or infrastructure code.
- `application/` MUST depend on domain types and declared ports, never concrete
  adapters.
- Controllers and DTOs are inbound adapters. They validate and translate HTTP
  data but MUST NOT contain business rules.
- Prisma repositories, JWT services, password hashers, clocks, ID generators,
  queues, and external clients are outbound adapters behind ports.
- Prisma records are persistence models, not domain entities. Map them at the
  infrastructure boundary.
- Nest modules are composition roots. They bind ports to implementations and
  MUST NOT contain business rules.
- A bounded context MUST NOT access another context's tables or internal
  adapters. Cross-context calls use an explicitly exported application-facing
  contract.
- Code under shared locations MUST be domain-neutral. Do not use `shared` as a
  shortcut around context boundaries.

## Testing rules

Tests MUST follow the same boundaries:

1. Test domain entities, value objects, aggregates, invariants, and domain
   services with pure unit tests.
2. Test application use cases with deterministic fakes or in-memory port
   implementations; do not require NestJS or a real database.
3. Test outbound adapters with integration or contract tests.
4. Test HTTP validation, authentication, authorization, serialization, and
   public contracts with controller or e2e tests.
5. Enforce forbidden imports and dependency direction with architecture tests
   or lint rules.
6. Every bug fix requires a regression test.

The repository-wide zero-tolerance rule for skipped, disabled, placeholder, or
conditional tests remains in force.

## Minimum coverage

`apps/api` MUST independently maintain at least **80%** in every coverage metric:

- statements: 80%;
- branches: 80%;
- functions: 80%;
- lines: 80%.

The coverage command and CI MUST fail when any metric is below its threshold.
Coverage from another workspace or app cannot compensate for an API shortfall.

Coverage exclusions are limited to generated code, declaration files,
declarative configuration, and composition roots that contain only dependency
wiring. Business logic, controllers, use cases, adapters, error branches, and
domain models MUST NOT be excluded to reach the threshold. Every exclusion must
be explicit and justified next to the coverage configuration.

Do not lower thresholds, add ignore directives, or write assertion-free tests to
make coverage pass. Add meaningful tests instead.

## Change workflow

DDD/hexagonal migrations and coverage-enforcement changes affect behavior or
build policy. They require an approved OpenSpec change under
`.openspec/changes/<feature>/` before implementation, as required by the root
rules.
