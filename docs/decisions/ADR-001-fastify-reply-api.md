# ADR-001 — Use Fastify reply API, not Node ServerResponse API

- **Status:** Accepted
- **Date:** 2026-08-04

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

- Skill: `nestjs-fastify-gotchas` Gotcha 2.
