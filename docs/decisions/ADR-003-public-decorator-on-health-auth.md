# ADR-003 — `@Public()` required on health/auth endpoints

- **Status:** Accepted
- **Date:** 2026-08-04

## Context

We register `JwtAuthGuard` globally via `APP_GUARD` so every endpoint is
authenticated by default. Without an explicit opt-out, infra-level
endpoints (`/api/health`, login, register, refresh) are also auth-gated.
Health probes (Kubernetes liveness, Docker `HEALTHCHECK`, monitoring
agents) carry no JWT — they expect a 200. A globally-guarded health
endpoint returns 401 and marks the pod unhealthy, causing restart loops.

## Decision

Endpoints that must be reachable without authentication MUST carry the
`@Public()` decorator at the class level:

```ts
@Public()
@ApiTags("health")
@Controller("health")
export class HealthController {
 /* ... */
}
```

Required: `health`, `auth/login`, `auth/register`, `auth/refresh`. No
exceptions. Endpoint-local overrides are not supported — `@Public()` is
class-level only.

## Consequences

- **Easier:** Health probes work; users can authenticate.
- **Harder:** A new unauthenticated endpoint requires remembering the
 decorator (mitigated by the auto-check below).
- **Trade-off:** Accept — the alternative is operational breakage that
 is hard to attribute to a missing decorator.

## Enforcement

- Skill: `nestjs-fastify-gotchas` Gotcha 4.
- E2E test: `apps/api/test/health.e2e-spec.ts` hits `/api/health` without
 a token and expects 200.
