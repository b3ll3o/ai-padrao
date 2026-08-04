# Change: Adopt DDD/hexagonal contexts and enforce 80% app coverage

## Why

The current API services mix business orchestration with Prisma, JWT, and
hashing, while the web mixes application flow with Next.js and HTTP details.
Neither app currently enforces a coverage threshold.

## What changes

- Introduce vertical bounded contexts in `apps/api` and feature contexts in
  `apps/web`.
- Migrate `users`, API `auth`, and web `auth` incrementally behind ports.
- Preserve current HTTP, cookie, JWT, Prisma, and route contracts.
- Enforce 80% statements, branches, functions, and lines independently in each
  app.
- Add lint-based architecture guards.

## Impact

Application structure, dependency wiring, tests, coverage scripts, and CI/build
quality gates change. No database or public contract change is intended.
