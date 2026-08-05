# Architecture

`ai-padrao` is a pnpm 9 + Turborepo monorepo with two applications:

- `apps/api` — NestJS 11 (Fastify) + Prisma 6 + Zod backend.
- `apps/web` — Next.js 15 (App Router) + Tailwind 4 + shadcn/ui frontend.

Both applications follow Domain-Driven Design (DDD) and **hexagonal
architecture** (a.k.a. ports and adapters). Business capabilities are
organized as vertical bounded contexts; framework and infrastructure concerns
are isolated behind ports. See [`AGENTS.md`](./AGENTS.md) for the global rules
that govern this layout, the per-app extensions in
[`apps/api/AGENTS.md`](./apps/api/AGENTS.md) and
[`apps/web/AGENTS.md`](./apps/web/AGENTS.md), and
[`docs/decisions/`](./docs/decisions/) for the decisions that produced it.

---

## System map

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              apps/web (Next.js)                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Feature contexts in apps/web/src/features/<context>/                       │
│                                                                            │
│  Auth                                                                     │
│  ├─ domain      ports (AuthApiPort, AuthCookieStorePort, AuthNavigationPort)│
│  ├─ application use cases (login, register, logout, refresh-session) + fakes│
│  ├─ adapters    presentation (login-form.tsx, register-form.tsx)           │
│  └─ infra       adapters (fetch-auth-api, next-auth-cookie-store,          │
│                 next-auth-navigation, browser-auth-cookie-store)           │
│                                                                            │
│  Composition roots: middleware.ts, app/actions/* (server actions),         │
│                     app/(auth)/* page segments                              │
└────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │  HTTP (fetch, httpOnly cookies)
                                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                              apps/api (NestJS)                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Vertical bounded contexts in apps/api/src/contexts/<context>/             │
│                                                                            │
│  Users                                                                    │
│  ├─ domain      User entity, value objects (Email, Name, UserRole),        │
│  │              UserRepositoryPort, errors                                 │
│  ├─ application use cases (list, find, update, remove) + InMemory repository│
│  ├─ infra       PrismaUserRepository, PrismaUserMapper,                    │
│  │              UsersHttpController, UsersContextModule (composition root) │
│                                                                            │
│  Auth                                                                     │
│  ├─ domain      Ports (UserAuthRepository, PasswordHasher,                 │
│  │              AccessTokenIssuer, RefreshTokenHasher, RefreshTokenStore,  │
│  │              RefreshTokenGenerator) + errors                            │
│  ├─ application use cases (register, login, refresh, logout) + fakes       │
│  ├─ infra       Argon2PasswordHasher, JwtAccessTokenIssuer,                │
│  │              Sha256RefreshTokenHasher, RandomRefreshTokenGenerator,     │
│  │              PrismaUserAuthRepository, PrismaRefreshTokenStore,         │
│  │              AuthHttpController, parse-ttl helper, JwtStrategy,         │
│  │              AuthContextModule (composition root)                       │
│                                                                            │
│  Composition roots: src/app.module.ts (AppModule)                           │
│  Cross-cutting: src/infra/* (Prisma, OpenTelemetry, helmet, throttler)     │
└────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                            PostgreSQL (Prisma)
```

---

## Layer responsibilities

Each context is a **vertical slice** with four concentric layers. Dependencies
point inward — outer layers know inner layers, never the other way around.

| Layer                | Owns                                                                                                                                                               | Allowed dependencies                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| **domain**           | Entities, value objects, domain errors, **ports** (interfaces)                                                                                                     | The language runtime. Nothing else.                                       |
| **application**      | Use cases, in-memory fakes for ports, application-level result types                                                                                               | `domain`, ports only.                                                     |
| **infrastructure**   | Framework adapters (Nest controllers, JWT strategy), persistence adapters (Prisma), security adapters (Argon2id), web adapters (Next `fetch`, cookies, navigation) | `domain` ports, `application` use cases (for HTTP wiring), the framework. |
| **composition root** | Nest `*ContextModule` (api) / Next middleware + server actions (web) that bind every port to an adapter explicitly                                                 | All layers.                                                               |

Inward direction is enforced by ESLint rules — see the per-app
`eslint.config.mjs`. The api uses
`@ai-padrao/config-eslint/nest.js`; the web uses the React preset.

### Why a four-layer split

- **Domain stays pure.** No Nest, no Prisma, no React. Domain code is
  framework-free so it can be unit-tested with zero mocks and reused if the
  delivery mechanism changes.
- **Use cases stay adapter-free.** They depend on ports and on in-memory
  fakes shipped under `application/testing/` for deterministic tests.
- **Adapters stay thin.** Their job is to translate between the framework
  world (HTTP requests, Prisma rows, JWT claims, cookie stores) and the port
  shape. No business logic lives here.
- **Composition roots are explicit.** Every port binding is visible at the
  module/middleware layer. Grep for `bind:` in
  `apps/api/src/contexts/*/auth-context.module.ts` (and its users twin) to
  see the wiring table.

---

## API: `apps/api/src/contexts/`

Each bounded context is a self-contained folder. Layout (paths grounded in the
implemented state):

```
apps/api/src/contexts/
├── auth/
│   ├── auth-context.module.ts        # composition root (Nest module)
│   ├── auth-context.tokens.ts        # DI tokens for every port
│   ├── application/
│   │   ├── auth-result.ts            # register/login/refresh result types
│   │   ├── testing/                  # in-memory fakes for ports
│   │   │   ├── fake-access-token.issuer.ts
│   │   │   ├── fake-password.hasher.ts
│   │   │   ├── fake-refresh-token.generator.ts
│   │   │   ├── fake-refresh-token.hasher.ts
│   │   │   ├── in-memory-refresh-token.store.ts
│   │   │   └── in-memory-user-auth.repository.ts
│   │   └── use-cases/
│   │       ├── login.use-case.{ts,spec.ts}
│   │       ├── logout.use-case.{ts,spec.ts}
│   │       ├── refresh.use-case.{ts,spec.ts}
│   │       └── register.use-case.{ts,spec.ts}
│   ├── domain/
│   │   ├── errors/
│   │   │   ├── email-already-registered.error.ts
│   │   │   └── invalid-credentials.error.ts
│   │   └── ports/
│   │       ├── access-token-issuer.port.ts
│   │       ├── password-hasher.port.ts
│   │       ├── refresh-token-generator.port.ts
│   │       ├── refresh-token-hasher.port.ts
│   │       ├── refresh-token-store.port.ts
│   │       └── user-auth.repository.port.ts
│   └── infrastructure/
│       ├── http/
│       │   ├── auth-http.controller.{ts,spec.ts}
│       │   └── dto/
│       ├── persistence/prisma/      # PrismaUserAuthRepository + PrismaRefreshTokenStore
│       ├── security/
│       │   ├── argon2-password.hasher.{ts,spec.ts}
│       │   ├── jwt-access-token.issuer.{ts,spec.ts}
│       │   ├── jwt.strategy.{ts,spec.ts}
│       │   ├── random-refresh-token.generator.{ts,spec.ts}
│       │   └── sha256-refresh-token.hasher.{ts,spec.ts}
│       └── ttl/parse-ttl.{ts,spec.ts}
└── users/
    ├── users-context.module.ts
    ├── users-context.tokens.ts
    ├── application/
    │   ├── testing/                  # in-memory fakes for ports
    │   └── use-cases/
    │       ├── find-user.use-case.{ts,spec.ts}
    │       ├── list-users.use-case.{ts,spec.ts}
    │       ├── remove-user.use-case.{ts,spec.ts}
    │       └── update-user.use-case.{ts,spec.ts}
    ├── domain/
    │   ├── entities/user.{ts,spec.ts}
    │   ├── errors/user-not-found.error.ts
    │   ├── ports/user-repository.port.ts
    │   └── value-objects/{email,name,user-role}.{ts,spec.ts}
    └── infrastructure/
        ├── http/users-http.controller.{ts,spec.ts}
        └── persistence/prisma/      # PrismaUserRepository + PrismaUserMapper
```

### Composition root: `AppModule`

`apps/api/src/app.module.ts` imports `AuthContextModule` and
`UsersContextModule`. Each context module owns its ports and binds them
explicitly (e.g. `bind: PasswordHasher -> Argon2PasswordHasher`). No port
imports a concrete adapter directly.

### Prisma mappings

The api owns Prisma. Each persistence adapter follows the **mapper pattern**:

- `PrismaUserMapper` (auth + users) — round-trip between Prisma rows and
  domain `User` entities. Covered by mapper unit tests.
- `PrismaUserRepository` and `PrismaUserAuthRepository` — depend on
  `PrismaService` through a typed port; the controller never sees Prisma.

`apps/web` MUST NOT import Prisma — that is enforced by ESLint and by
`AGENTS.md`.

---

## Web: `apps/web/src/features/`

```
apps/web/src/features/
└── auth/
    ├── adapters/presentation/
    │   ├── login-form.{tsx,spec.tsx}
    │   └── register-form.{tsx,spec.tsx}
    ├── application/
    │   ├── route-access.policy.{ts,spec.ts}
    │   ├── testing/
    │   │   ├── fake-auth-api.ts
    │   │   ├── fake-auth-navigation.ts
    │   │   └── in-memory-auth-cookie-store.ts
    │   └── use-cases/
    │       ├── login.use-case.{ts,spec.ts}
    │       ├── logout.use-case.{ts,spec.ts}
    │       ├── refresh-session.use-case.{ts,spec.ts}
    │       └── register.use-case.{ts,spec.ts}
    ├── domain/
    │   ├── errors/auth-flow.error.ts
    │   └── ports/
    │       ├── auth-api.port.ts
    │       ├── auth-cookie-store.port.ts
    │       └── auth-navigation.port.ts
    └── infrastructure/adapters/
        ├── auth-cookie.config.ts
        ├── browser-auth-cookie-store.adapter.{ts,spec.ts}
        ├── fetch-auth-api.adapter.{ts,spec.ts}
        ├── next-auth-cookie-store.adapter.{ts,spec.ts}
        └── next-auth-navigation.adapter.{ts,spec.ts}
```

### Web ports

| Port                  | Adapter(s)                                                                                 | Purpose                                                       |
| --------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `AuthApiPort`         | `fetch-auth-api.adapter`                                                                   | Talks to the api over HTTP for login/refresh/logout/register. |
| `AuthCookieStorePort` | `next-auth-cookie-store.adapter` (server) and `browser-auth-cookie-store.adapter` (client) | Reads/writes the refresh-token httpOnly cookie.               |
| `AuthNavigationPort`  | `next-auth-navigation.adapter`                                                             | Framework-agnostic redirect policy used by use cases.         |

Use cases depend on these ports; the forms and server actions are composition
roots that bind each port to its adapter.

### Composition roots (web)

- `apps/web/src/middleware.ts` — refresh-on-request middleware; binds cookie
  store + API port + navigation port.
- `apps/web/src/app/(auth)/*` — page segments; bind presentation adapters
  (login/register forms) and the server actions.
- `apps/web/src/app/actions/*` — server actions; call the use cases with
  explicit port bindings.

---

## Cross-cutting

- **`apps/api/src/infra/`** — Prisma client wiring, OpenTelemetry SDK,
  Fastify helmet, throttler, and other framework-level concerns. Used by
  `AppModule`; never imported from domain or application.
- **`packages/contracts`** — shared Zod schemas and DTOs. Both apps depend on
  it; nothing in `packages/contracts` depends on either app.
- **`packages/config-eslint`, `packages/config-tsconfig`,
  `packages/config-tailwind`, `packages/ui`, `packages/db`** — shared
  tooling consumed by both apps.

## Testing

Each layer ships tests next to the code (`*.spec.ts`). The harness auto-check
`INC-012` (no skipped tests) and the aggregate coverage gate enforce that:

- Every `*.spec.ts` / `*.spec.tsx` file contains at least one real `it()`.
- Each app independently reports **≥ 80%** statements, branches, functions,
  and lines. See [`ADR-013`](./docs/decisions/ADR-013-independent-80-percent-coverage.md).

## Where to go next

- New feature → follow [`.openspec/AGENTS.md`](./.openspec/AGENTS.md) (SDD is mandatory).
- Touching the api → re-read [`apps/api/AGENTS.md`](./apps/api/AGENTS.md).
- Touching the web → re-read [`apps/web/AGENTS.md`](./apps/web/AGENTS.md).
- Architecture rationale → [`docs/decisions/`](./docs/decisions/) (ADR-012, ADR-013).
- Validation commands and Definition of Done → [`CONTRIBUTING.md`](./CONTRIBUTING.md).
