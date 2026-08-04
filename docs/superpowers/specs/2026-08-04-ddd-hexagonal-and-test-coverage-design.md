---
title: DDD, Hexagonal Architecture, and Minimum Test Coverage
date: 2026-08-04
status: approved (brainstorming exit)
scope: app rules and implementation planning
---

# DDD, Hexagonal Architecture, and Minimum Test Coverage — Design

## Goal

Make Domain-Driven Design (DDD), hexagonal architecture, and a minimum test
coverage of 80% explicit project rules for both applications, then define an
incremental migration plan for the existing API and web code.

This design has two deliverable groups:

1. Documentation-only rule changes that establish the target architecture and
   quality gate.
2. A future behavior-changing migration, executed through an approved OpenSpec
   change before application code or test configuration is modified.

## Current state

The repository currently uses a conventional feature-based structure:

- `apps/api` uses NestJS modules whose services access `PrismaService`
  directly. Nest services combine orchestration, persistence, hashing, and JWT
  concerns. Prisma records also act as application/domain models.
- `apps/web` uses App Router pages, components, and helpers under `src/lib`.
  Components and framework code own part of the application orchestration.
- Neither app has a local `AGENTS.md`.
- The API Jest configuration does not define coverage thresholds.
- The web Vitest configuration does not define a coverage provider or
  thresholds.
- No global or per-app command currently enforces coverage.

The existing contracts and external behavior must remain stable during the
migration.

## Considered approaches

### Option A — vertical bounded contexts (chosen)

Each functional context owns its domain, application, inbound adapters, and
outbound adapters. Existing contexts migrate one at a time.

Benefits:

- preserves bounded-context ownership;
- supports incremental migration;
- prevents global layer directories from becoming unrelated collections;
- allows each migrated context to remain independently understandable and
  testable.

Cost: some structural repetition between contexts.

### Option B — global technical layers

Create one global `domain`, `application`, `adapters`, and `infrastructure`
directory per app.

This is initially simple, but it weakens bounded-context ownership and tends to
couple unrelated features through shared technical folders.

### Option C — DDD only in the API

Apply strict DDD and hexagonal boundaries to the backend while retaining a
framework-oriented frontend.

This requires less work, but it does not satisfy the requirement that both apps
follow the paradigms.

## Architectural decision

Use vertical bounded contexts in both apps and migrate incrementally. Apply DDD
pragmatically: domain abstractions are required where business behavior exists,
but purely presentational code does not need artificial entities or value
objects.

### API target

A context such as `users` or `auth` owns these responsibilities:

```text
<context>/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   ├── services/
│   └── ports/
├── application/
│   ├── use-cases/
│   └── ports/
├── adapters/
│   └── inbound/http/
├── infrastructure/
│   └── adapters/
└── <context>.module.ts
```

Rules:

1. Domain code is framework-independent and must not import NestJS, Fastify,
   Prisma, database clients, HTTP libraries, or UI concerns.
2. Application use cases orchestrate domain behavior and depend only on domain
   types and declared ports.
3. Controllers and DTOs are inbound adapters. They validate and translate
   transport data but do not implement business rules.
4. Prisma repositories, JWT issuers, password hashers, clocks, ID generators,
   and external integrations are outbound adapters behind ports.
5. Prisma records are persistence models, not domain entities.
6. Nest modules are composition roots that bind ports to adapters.
7. Contexts communicate through an explicitly exported application-facing
   contract. They must not access another context's tables or internal adapters.
8. Existing cross-cutting code under `src/common` and `src/infra` remains shared
   only when it is genuinely technical and domain-neutral.

### Web target

A frontend context such as `auth` owns these responsibilities:

```text
features/<context>/
├── domain/
│   ├── models/
│   ├── value-objects/
│   └── ports/
├── application/
│   ├── use-cases/
│   └── ports/
├── adapters/
│   └── presentation/
└── infrastructure/
    └── adapters/
```

Rules:

1. Domain code must not import React, Next.js, browser APIs, transport clients,
   or rendering libraries.
2. Application code depends on domain types and ports, not concrete HTTP or
   framework APIs.
3. Pages, React components, forms, hooks, and view models are presentation
   adapters.
4. The HTTP client, cookie-aware server integration, and other external access
   are infrastructure adapters.
5. Components must not contain domain rules or depend directly on concrete
   transport details.
6. Shared request and response schemas continue to come from
   `packages/contracts`.
7. Authentication tokens remain in httpOnly cookies and never move to
   `localStorage`.
8. Presentational-only pages may remain simple; DDD abstractions are introduced
   only for actual behavior and invariants.

## Dependency direction

The allowed dependency direction in each context is:

```text
inbound adapters ──> application ──> domain
                         │
                         v
                 outbound port interface
                         ^
                         │
              infrastructure adapter
```

The composition root can see all layers to construct the dependency graph. No
other layer may reverse this direction.

## Coverage policy

Each application must independently maintain at least 80% coverage in all four
metrics:

| Metric     | `apps/api` | `apps/web` |
| ---------- | ---------: | ---------: |
| Statements |        80% |        80% |
| Branches   |        80% |        80% |
| Functions  |        80% |        80% |
| Lines      |        80% |        80% |

One app cannot compensate for the other. A high line percentage cannot
compensate for a branch, function, or statement percentage below 80%.

### Coverage enforcement

The future implementation will:

1. add global Jest thresholds to `apps/api/jest.config.ts`;
2. configure the Vitest coverage provider and thresholds in
   `apps/web/vitest.config.ts`;
3. add `test:coverage` scripts to both apps and an aggregate root command;
4. make CI and the Definition of Done run the aggregate coverage command;
5. fail validation when any app or metric is below 80%.

The ordinary `test` command may remain optimized for fast local feedback. The
coverage command is the mandatory quality gate.

### Legitimate exclusions

Coverage configuration may exclude only code that cannot provide meaningful
execution coverage:

- generated code;
- TypeScript declaration files;
- declarative configuration files;
- composition roots containing only dependency wiring.

Business logic, controllers, use cases, adapters, error branches, and domain
models cannot be excluded merely to reach the threshold. Every exclusion must
be explicit and justified in the relevant app rule file or test configuration.

### Testing strategy

API tests will be organized by boundary:

1. Pure unit tests for aggregates, entities, value objects, domain services,
   and invariants.
2. Application tests for use cases using deterministic fakes or in-memory port
   implementations.
3. Adapter integration and contract tests for Prisma and external services.
4. HTTP e2e tests for validation, authentication, authorization, serialization,
   and public contracts.
5. Architecture tests that reject forbidden imports and dependency direction
   violations.

Web tests will be organized by boundary:

1. Pure unit tests for frontend domain rules and value objects.
2. Application tests for use cases with fake ports.
3. Presentation tests for forms, hooks, view models, and critical components.
4. Infrastructure tests for HTTP adapters and error translation.
5. Integration tests for login, registration, session, and redirect behavior.
6. Architecture tests that prevent domain/application imports from React,
   Next.js, or concrete transport implementations.

All existing zero-tolerance rules for skipped or placeholder tests remain in
force. A bug fix must include a regression test, and tests must contain
meaningful assertions rather than existing only to increase coverage.

## Rule documentation

Create these app-specific rule files:

- `apps/api/AGENTS.md` — API DDD/hexagonal boundaries, dependency rules,
  testing layers, and 80% per-metric threshold.
- `apps/web/AGENTS.md` — web DDD/hexagonal boundaries, pragmatic frontend DDD,
  testing layers, and 80% per-metric threshold.

Update the root `AGENTS.md` with only the cross-app principles and links to the
local rules. The local files complement the root rules and must not weaken
SDD, security, harness, or no-skipped-test requirements.

The documentation work will also update the architectural orientation and
decision index as appropriate. The architecture decisions will record:

1. vertical bounded contexts with inward dependency direction for both apps;
2. independent 80% thresholds for statements, branches, functions, and lines.

Because the current ADR index is incident-oriented, these architectural ADRs
must explicitly identify themselves as proactive decisions rather than invent
incident references.

## Incremental migration sequence

The implementation plan will use this order:

1. Open an OpenSpec change with proposal, tasks, design, and spec delta; stop
   for human approval before behavior-changing work.
2. Introduce dependency-boundary and coverage tooling without lowering existing
   correctness requirements.
3. Measure the baseline and add missing characterization tests until both apps
   can satisfy the gate honestly.
4. Migrate the API `users` context as the first vertical slice.
5. Migrate the API `auth` context while preserving JWT, refresh-token rotation,
   cookies, and public contracts.
6. Migrate the web authentication context, including login, registration,
   session, and redirects.
7. Move future features directly into the target structure.
8. Remove legacy paths only after all consumers and tests have moved.
9. Update architecture documentation, ADRs, and OpenSpec artifacts to match the
   final verified implementation.

Each context migration must keep the application buildable and testable. Public
contracts may change only through an explicitly approved OpenSpec delta.

## Error handling and observability

Domain and application layers return or throw domain/application errors that do
not depend on HTTP status codes or framework exception classes. Inbound adapters
translate them to transport responses. Outbound adapters translate
infrastructure failures into application-level failures without exposing Prisma
or vendor errors.

Existing Nest logging and OpenTelemetry rules remain in force. Domain code does
not log through Nest; adapters and composition roots own technical logging and
tracing.

## Acceptance criteria

The documentation and plan phase is complete when:

1. both app-specific `AGENTS.md` files state unambiguous DDD, hexagonal, and
   coverage rules;
2. the root rules link to the local files and state the shared requirements;
3. the design document and implementation plan describe an incremental,
   OpenSpec-gated migration;
4. no application behavior or test configuration is changed during the
   documentation-only phase.

The future migration is complete when:

1. both apps enforce at least 80% statements, branches, functions, and lines
   independently;
2. CI fails if any metric in either app is below the threshold;
3. domain and application layers are independent from frameworks and concrete
   infrastructure;
4. persistence, HTTP, and presentation concerns are implemented as adapters;
5. architecture tests prevent dependency regressions;
6. `users` and `auth` have migrated without unapproved external contract
   changes;
7. all test, lint, typecheck, build, harness, and coverage checks pass;
8. architecture docs, ADRs, and archived OpenSpec specs reflect the result.

## Out of scope

- A big-bang rewrite of either app.
- Changing API request/response contracts as a side effect of restructuring.
- Introducing domain abstractions into purely presentational code.
- Lowering or bypassing coverage thresholds for legacy code.
- Skipping, disabling, or replacing meaningful tests with placeholders.
- Modifying application code before OpenSpec proposal approval.

## Risks and mitigations

| Risk                                             | Mitigation                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Excess abstraction in the web app                | Require domain abstractions only where behavior or invariants exist             |
| Migration stalls because current coverage is low | Add characterization tests before moving each context; never lower thresholds   |
| Prisma or framework types leak inward            | Enforce dependency rules with architecture tests and adapter mappings           |
| Duplicate rules drift between root and app files | Keep shared principles at the root and implementation details in local files    |
| Large auth migration changes behavior            | Preserve contracts, migrate behind ports, and retain e2e regression coverage    |
| Coverage exclusions hide untested behavior       | Maintain a narrow explicit allowlist and require justification                  |
| Contexts become coupled through shared helpers   | Export application-facing contracts and keep domain-neutral shared code minimal |

## Spec self-review

**Placeholder scan:** No `TBD`, `TODO`, unresolved option, or unspecified
threshold remains.

**Internal consistency:** The selected vertical-context structure matches the
incremental migration sequence. Both apps use the same inward dependency rule,
while the web rule explicitly avoids artificial modeling of presentation-only
code. The 80% requirement applies independently to all four metrics in both
apps throughout the document.

**Scope check:** Documentation/rule work and future application migration are
separated. The migration is large but decomposed into independently verifiable
contexts and remains one coherent architecture initiative.

**Ambiguity check:** “80% coverage” means statements, branches, functions, and
lines, measured independently for each app. “Follow DDD” means domain-driven
boundaries where business behavior exists, not mandatory entities for every
file. “Hexagonal” means ports and adapters with dependency direction toward the
domain, enforced by tests.
