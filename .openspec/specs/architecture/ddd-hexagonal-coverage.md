# Architecture specification delta

## ADDED Requirements

### Requirement: Inward dependency direction

Both apps SHALL organize business capabilities as vertical contexts. Domain
code SHALL NOT import frameworks or infrastructure, and application code SHALL
depend on outbound capabilities through ports.

#### Scenario: API domain import validation

- **WHEN** lint runs against an API domain or application file
- **THEN** imports from NestJS, Fastify, Prisma, or infrastructure paths fail

#### Scenario: Web domain import validation

- **WHEN** lint runs against a web domain or application file
- **THEN** imports from React, Next.js, browser APIs, or infrastructure paths fail

### Requirement: Independent coverage gates

Each app SHALL enforce at least 80% statements, branches, functions, and lines.

#### Scenario: One metric is below 80%

- **WHEN** an app's coverage command reports any metric below 80%
- **THEN** that command and the aggregate root command fail

#### Scenario: Both apps meet all thresholds

- **WHEN** both app coverage commands report all four metrics at or above 80%
- **THEN** the aggregate coverage command succeeds

### Requirement: Contract preservation

The migration SHALL preserve existing API routes, status codes, Zod contracts,
cookie names, JWT claims, token rotation behavior, and web routes.
