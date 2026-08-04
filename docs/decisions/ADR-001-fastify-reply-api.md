# ADR-001 — Use Fastify reply API, not Node ServerResponse API

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-002 (full context in `.harness/INCIDENTS.md`)

## Context

In NestJS under `FastifyAdapter`, `context.switchToHttp().getResponse()`
returns a Fastify `FastifyReply`, not a Node `http.ServerResponse`. Writing
interceptors/middleware/decorators that call Node response methods
(`res.setHeader`, `res.cookie`, `res.send`) compiles cleanly, passes unit
tests that mock the response, and explodes at runtime with "is not a
function" errors — once real traffic hits.

## Decision

In any file under `apps/api/src/` that obtains an HTTP response from a
NestJS execution context, use Fastify's `reply.header(name, value)` and
`reply.send(payload)` APIs. Type the response as `FastifyReply` (import
from `fastify`) and document any cross-API call.

A quick mental rule: if the variable was named `res`, rename it to `reply`
and switch every method to the Fastify equivalent.

## Consequences

- **Easier:** Interceptors and guards compile against the actual response
  shape; failures surface at type-check time, not runtime.
- **Harder:** Patterns borrowed from Express middleware need manual translation.
- **Trade-off:** Accept — the alternative (silently wrong at runtime) is
  strictly worse; we already lived it.

## Enforcement

- Auto-check **INC-002** in `.harness/check.sh` greps
  `apps/api/src/**` for `setHeader|res\.cookie|res\.json(` (with
  command-specific exclusions) and fails the build on any match.
- Skill: `nestjs-fastify-gotchas` Gotcha 2.
- Codemod: `.harness/codemods/inc-002-fastify-response.py` rewrites the
  forbidden patterns to their Fastify equivalent (use
  `pnpm harness:codemod inc-002-fastify-response --check <file>` to see the
  proposal before applying).
