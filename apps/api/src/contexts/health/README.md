# `contexts/health` — pragmatic DDD-hexagonal context

## Purpose

Two infra probes used by orchestrators (Kubernetes, docker compose healthcheck,
load balancers) and by humans running smoke tests:

- `GET /health` — **liveness**. Process is up. No I/O. Returns
 `{ status: "ok", uptime: <seconds> }`.
- `GET /health/ready` — **readiness**. Delegates to a `HealthCheckPort`
 that pings Postgres. Returns `{ status: "ok", db: "up" }` on success
 or `{ status: "error", db: "down" }` on failure (underlying error is
 swallowed — see ADR-006).

Both endpoints are decorated with `@Public()` — they must remain
reachable before a JWT can be issued (see ADR-003).

## Why a "bounded context" for two endpoints?

`apps/api/AGENTS.md` requires every business capability to live as a
vertical bounded context under `apps/api/src/contexts/`. This folder
exists to honour that rule while still being honest about what is
actually here. Read on before adding files.

## Structure (intentionally thin)

```text
contexts/health/
├── health-context.module.ts # composition root (DI wiring)
├── health-context.tokens.ts # Symbol-based DI token for the port
├── domain/
│ └── ports/
│ └── health-check.port.ts # outbound interface
└── infrastructure/
 ├── http/
 │ ├── health-http.controller.ts +.spec.ts
 └── persistence/
 └── prisma/
 ├── prisma-db-health-check.ts +.spec.ts
```

Notice what is **missing**:

- No `application/use-cases/` folder. The pragmatic-DDD rule in the
 root `AGENTS.md` and in `apps/api/AGENTS.md` §"Required architecture"
 says: "Create entities, value objects, aggregates, domain services,
 and domain events only when they represent real behavior or
 invariants. Do not add abstractions that only rename framework or
 database operations." Health probes are exactly that case — they
 rename `$queryRaw\`SELECT 1\`` and `process.uptime()` into a different
 file. We don't.
- No `domain/entities/` or `domain/value-objects/`. Nothing here has
 identity or invariants worth modelling.

## What stays inside the hexagon

- `HealthCheckPort` lives in `domain/ports/` because it is the only
 thing that matters about this context: a stable seam between the HTTP
 layer and whatever backend we probe. The Prisma adapter sits behind
 it, so swapping in a Redis or HTTP probe later is a one-line DI
 binding change.
- The HTTP controller depends on the **port token**, never on
 `PrismaService` directly. ADR-002.

## Migration history

The previous shape lived at `apps/api/src/modules/health/` (a flat
NestJS module — controller + module + spec) and violated the
"vertical bounded contexts" rule. The commit that introduced this
folder is the migration: same wire contract, new layout.