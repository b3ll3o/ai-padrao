# Architecture

The big-picture view of `ai-padrao`. For the day-to-day "how do I…"
questions see [`CONTRIBUTING.md`](CONTRIBUTING.md); for the rules AI
assistants must follow see [`AGENTS.md`](AGENTS.md). For the _why_ of
specific decisions see [`docs/decisions/`](docs/decisions/).

## 1. System diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                          docker-compose                         │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐               │
│  │ postgres │◄───┤   api    │    │     web      │               │
│  │  :5432   │    │ (NestJS) │    │  (Next.js)   │               │
│  └──────────┘    │ :3001    │    │   :3000      │               │
│       ▲          └────┬─────┘    └──────┬───────┘               │
│       │               │                │                        │
│       │          ┌────▼─────┐    ┌─────▼──────┐                │
│       │          │ mailhog  │    │   otel-    │                │
│       │          │ :11025   │    │  collector │                │
│       │          │ :18025   │    │   :4317    │                │
│       │          └──────────┘    └─────┬──────┘                │
│       │                                │                       │
│       │         (mailhog receives      │ OTLP export           │
│       │          dev-only emails)      ▼                       │
│       │                          ┌──────────┐                  │
│       └──────────────────────────┤   OTel   │                  │
│                                  │ backend  │ (any vendor)     │
│                                  └──────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

Local dev runs everything in `docker-compose.yml`. Production drops
the mailhog and otel-collector containers and points the api/web at
managed equivalents.

## 2. Monorepo shape

```text
apps/
  api/           NestJS 11 + Fastify adapter. Only app that uses Prisma.
  web/           Next.js 15 App Router. Imports types from packages/contracts.
packages/
  contracts/     Zod schemas. Source of truth for request/response shapes.
                 Touch BEFORE schema.prisma.
  db/            Prisma client wrapper, migrations, seed helpers.
  ui/            shadcn/ui components + Tailwind 4 primitives.
  config-*/      Shared TS / ESLint / Prettier configs.
docs/
  decisions/     ADRs (Nygard format). Each one a real decision.
  superpowers/   Brainstorming and planning artifacts.
.openspec/       SDD workflow (proposal → approval → build → archive).
infra/           Dockerfiles, observability collector config.
```

The `apps/web` and `apps/api` are siblings. They MUST NOT import each
other; their shared surface is `packages/contracts` (Zod) and HTTP.
This keeps the deploy story symmetric — either app can be swapped
without touching the other.

## 3. Request flow (web → api)

```text
Browser
  │  httpOnly cookie: ai-padrao-refresh=<opaque>
  │
  ▼
Next.js (apps/web)
  │  Server Component / Route Handler
  │  imports typed client from packages/contracts
  │  Authorization: Bearer <access JWT, in-memory only>
  ▼
NestJS (apps/api) — Fastify adapter
  │  Helmet → CORS → RateLimit → JwtAuthGuard (global via APP_GUARD)
  │  ValidationPipe (Zod via nestjs-zod, schema from packages/contracts)
  │  Controller → Service → Prisma
  ▼
PostgreSQL 16
  │  Prisma 6 client (apps/api only)
  ▼
Response (typed by Zod, same schema on both sides)
```

Public endpoints (`/api/health`, `/api/auth/*`) carry the `@Public()`
decorator to opt out of the global JWT guard. See
[ADR-003](docs/decisions/ADR-003-public-decorator-on-health-auth.md).

## 4. Auth flow

```text
login / register
   │
   ▼  (Argon2id verify)
issue access JWT (15 min) ──── returned in response body
issue refresh token (opaque) ──── set as httpOnly cookie, rotated on use
   │
   ▼
subsequent requests
   │
   ├── Authorization: Bearer <access JWT>           ← short-lived
   │
   ├── on 401, POST /api/auth/refresh                ← uses httpOnly cookie
   │     ├── rotate refresh (one-time use, recorded in DB)
   │     ├── issue new access JWT
   │     └── set new httpOnly cookie
   │
   └── logout: POST /api/auth/logout                  ← clears cookie + DB revoke
```

Tokens NEVER live in `localStorage`. The refresh token is opaque and
DB-tracked; rotation invalidates the previous token immediately. See
the api's auth module for the canonical implementation and
[`AGENTS.md`](AGENTS.md) for the rule.

## 5. Module map — apps/api

```text
src/
  main.ts                     bootstrap (Nest Logger only, see ADR-006)
  app.module.ts               root composition
  common/
    decorators/                @Public(), @CurrentUser(), @Roles()
    filters/                   exception → HTTP response mapping
    interceptors/              logging (Pino), request-id
    guards/                    JwtAuthGuard (global), RolesGuard (opt-in)
  modules/
    auth/                      login, register, refresh, logout
    health/                    GET /api/health (@Public, no deps)
    users/                     CRUD + roles
    audit/                     append-only audit log
    notifications/             email dispatch (uses mailhog in dev)
  prisma/
    prisma.module.ts           PrismaService (DI)
    prisma.service.ts
prisma/
  schema.prisma                source of truth, owned here
  migrations/                  generated, committed
  seed.ts                      admin user
```

Each module exports ONE service. Cross-module imports happen via the
service, never via the database. New modules land under
`src/modules/<feature>/` with the four-file skeleton
(`*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`).

## 6. Data model (Postgres via Prisma)

Core tables (see `apps/api/prisma/schema.prisma` for the source of
truth):

- `User` — id, email (unique), passwordHash (Argon2id), role, createdAt.
- `RefreshToken` — id, userId, tokenHash, expiresAt, revokedAt. Append-only;
  rotation revokes the old row.
- `AuditLog` — id, userId, action, targetType, targetId, payload (JSONB),
  createdAt. No updates or deletes — append-only.

The schema is owned by `apps/api`. `packages/contracts` re-exports the
Zod shapes that wrap the same fields. When the schema changes, the
contracts change FIRST, then `schema.prisma` — see the coordination
rule in [`AGENTS.md`](AGENTS.md).

## 7. Observability

OpenTelemetry SDK is initialized in `apps/api/src/main.ts` and in
`apps/web/instrumentation.ts`. Every HTTP request carries a
correlation id (request-id interceptor); every Prisma call is traced;
every log line carries the same trace + span ids.

In dev, traces export to the `otel-collector` container via OTLP
(gRPC :4317). The collector fans out to whatever backend the team
uses (Jaeger, Tempo, Honeycomb). Sampling rate is configured per
environment via `OTEL_TRACES_SAMPLER_ARG`.

Pino is the log transport. `console.*` is forbidden in
`apps/api/src/main.ts` (ADR-006). Every other module uses the Nest
`Logger`.

## 8. Why this shape

The architecture encodes 11 decisions, each linked to a real defect:

- [ADR-001](docs/decisions/ADR-001-fastify-reply-api.md) — Fastify
  reply API (Nest + Fastify interop was breaking at runtime).
- [ADR-002](docs/decisions/ADR-002-no-import-type-for-nest-di.md) —
  No `import type` for Nest DI (`emitDecoratorMetadata`).
- [ADR-003](docs/decisions/ADR-003-public-decorator-on-health-auth.md) —
  `@Public()` decorator on infra endpoints.
- [ADR-004](docs/decisions/ADR-004-dockerfile-copy-schema-before-generate.md) —
  Dockerfile copy-order for Prisma.
- [ADR-005](docs/decisions/ADR-005-non-default-ports.md) —
  Off-default host ports for compose.
- [ADR-006](docs/decisions/ADR-006-nest-logger-not-console.md) —
  Nest `Logger`, not `console.*`.
- [ADR-007](docs/decisions/ADR-007-no-skipped-tests.md) — Zero
  skipped tests.
- [ADR-011](docs/decisions/ADR-011-no-plaintext-secrets-in-source.md) —
  No plaintext tokens in tracked source.

Read the index at [`docs/decisions/README.md`](docs/decisions/README.md)
before opening a change to any of these areas.

## 9. Where to extend

- **New API endpoint:** open `.openspec/changes/<feature>/`,
  add Zod schema in `packages/contracts`, then controller in
  `apps/api/src/modules/<feature>/`.
- **New UI page:** add components in `packages/ui` first, then
  the route in `apps/web/app/<route>/page.tsx`.
- **New DB column:** update `packages/contracts` Zod, then
  `apps/api/prisma/schema.prisma`, then run `pnpm db:migrate`.
- **New ADR:** write `docs/decisions/ADR-NNN-<slug>.md` and add to
  the index table.
