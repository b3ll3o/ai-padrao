# Web Rules — DDD and Hexagonal Architecture

This file extends the repository-wide rules in [`../../AGENTS.md`](../../AGENTS.md).
The root rules remain authoritative. These rules apply to every file under
`apps/web/`.

## Required architecture

The web app MUST follow Domain-Driven Design (DDD) and hexagonal architecture
for capabilities that contain business behavior. New capabilities MUST be
organized as vertical feature contexts. Existing features migrate incrementally
without changing routes or API contracts unless an approved OpenSpec delta
explicitly changes them.

A feature context SHOULD use this shape:

```text
features/<context>/
├── domain/
├── application/
├── adapters/
│   └── presentation/
└── infrastructure/
    └── adapters/
```

Apply frontend DDD pragmatically. Purely presentational pages and components do
not need artificial entities, value objects, or use cases. Introduce domain
abstractions only for real behavior, invariants, and workflows.

## Dependency rules

Dependencies MUST point inward:

```text
presentation adapters -> application -> domain
infrastructure adapters -> application/domain ports
composition root -> all layers
```

- `domain/` MUST NOT import React, Next.js, browser APIs, HTTP clients,
  rendering libraries, or infrastructure code.
- `application/` MUST depend on domain types and declared ports, never concrete
  transport, cookie, navigation, or framework implementations.
- Pages, components, forms, hooks, and view models are presentation adapters.
  They MUST NOT contain domain rules.
- HTTP clients, cookie access, browser storage, server integration, and
  navigation are infrastructure adapters behind ports.
- App Router pages and factories act as composition roots where dependencies
  are assembled.
- Shared request and response schemas MUST continue to come from
  `packages/contracts`.
- Authentication tokens MUST stay in httpOnly cookies and MUST NEVER be stored
  in `localStorage` or `sessionStorage`.
- A feature MUST expose an explicit application-facing contract and MUST NOT
  import another feature's internal adapters.
- Code under shared locations MUST be framework-neutral or genuinely
  cross-cutting. Do not use `shared` to bypass feature boundaries.

## Testing rules

Tests MUST follow the same boundaries:

1. Test domain rules and value objects with pure unit tests.
2. Test application use cases with deterministic fake ports.
3. Test forms, hooks, view models, and critical components as presentation
   adapters.
4. Test HTTP, cookie, and navigation adapters with deterministic integration
   tests.
5. Cover critical login, registration, session, refresh, logout, and redirect
   flows.
6. Enforce forbidden imports and dependency direction with architecture tests
   or lint rules.
7. Every bug fix requires a regression test.

The repository-wide zero-tolerance rule for skipped, disabled, placeholder, or
conditional tests remains in force.

## Minimum coverage

`apps/web` MUST independently maintain at least **80%** in every coverage metric:

- statements: 80%;
- branches: 80%;
- functions: 80%;
- lines: 80%.

The coverage command and CI MUST fail when any metric is below its threshold.
Coverage from another workspace or app cannot compensate for a web shortfall.

Coverage exclusions are limited to generated code, declaration files,
declarative configuration, and composition roots that contain only dependency
wiring. Business logic, use cases, adapters, error branches, domain models,
forms, and behavioral components MUST NOT be excluded to reach the threshold.
Every exclusion must be explicit and justified next to the coverage
configuration.

Do not lower thresholds, add ignore directives, or write assertion-free tests to
make coverage pass. Add meaningful tests instead.

## Change workflow

DDD/hexagonal migrations and coverage-enforcement changes affect behavior or
build policy. They require an approved OpenSpec change under
`.openspec/changes/<feature>/` before implementation, as required by the root
rules.
