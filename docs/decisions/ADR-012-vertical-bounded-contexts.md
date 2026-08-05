# ADR-012: Vertical bounded contexts with inward-pointing dependencies

- **Status:** Accepted
- **Date:** 2026-08-04
- **Decision type:** Proactive architecture decision
- **Related ADRs:** [ADR-013](./ADR-013-independent-80-percent-coverage.md)

## Context

The `ai-padrao` monorepo ships two apps — `apps/api` (NestJS + Prisma) and
`apps/web` (Next.js) — that share authentication, users, and contract
schemas. Before this decision, both apps organized code by **technical layer**
(`controllers/`, `services/`, `repositories/`, `dto/`). That layout created
three recurring problems:

1. **Cross-cutting drift.** A change to "users" had to touch four
   sub-folders in two apps. Feature work rippled across the codebase instead
   of staying inside one slice.
2. **Leaky dependencies.** Domain logic in `services/` could reach directly
   into Prisma, Nest decorators, or React hooks. The framework owned the
   domain instead of the other way around.
3. **Inconsistent boundaries.** The api and the web each made up their own
   conventions for "what counts as business logic." Refactors in one app did
   not transfer cleanly to the other.

We needed a layout that (a) keeps business capabilities together, (b) makes
the framework an interchangeable detail, and (c) is enforceable from the
build pipeline rather than relying on review discipline.

## Decision

Both `apps/api` and `apps/web` organize business capabilities as **vertical
bounded contexts**. Every context is a self-contained folder with four
inward-pointing layers:

- `domain/` — entities, value objects, domain errors, **ports** (interfaces).
  Framework-free. Depends on the language runtime only.
- `application/` — use cases and in-memory fakes for ports. Depends on
  domain and on the port symbols it orchestrates.
- `infrastructure/` (api) / `adapters/` + `infrastructure/` (web) —
  framework adapters. Talks to Nest/Prisma/JWT on the api side and to
  Next.js/fetch/cookies on the web side. Depends inward on ports and
  outward on the framework.
- Composition root — the Nest `*ContextModule` (api) or the Next middleware
  - server actions + page segments (web) that bind each port to one
    adapter explicitly.

**Inward dependency direction.** Outer layers know inner layers; inner
layers never import from outer layers. Enforced by ESLint rules in each
app's `eslint.config.mjs` and cross-checked by the no-skipped-tests harness
auto-check `INC-012` and the architecture boundary grep.

**Implemented contexts.**

- API (`apps/api/src/contexts/`):
  - `users/` — `User` entity, value objects (`Email`, `Name`, `UserRole`),
    `UserRepositoryPort`, use cases (`list-users`, `find-user`,
    `update-user`, `remove-user`), `PrismaUserRepository` + mapper,
    `UsersHttpController`, `UsersContextModule`.
  - `auth/` — six ports (`UserAuthRepository`, `PasswordHasher`,
    `AccessTokenIssuer`, `RefreshTokenHasher`, `RefreshTokenStore`,
    `RefreshTokenGenerator`), use cases (`register`, `login`, `refresh`,
    `logout`), adapters (`Argon2PasswordHasher`,
    `JwtAccessTokenIssuer`, `Sha256RefreshTokenHasher`,
    `RandomRefreshTokenGenerator`, Prisma repositories),
    `AuthHttpController`, `AuthContextModule`.
- Web (`apps/web/src/features/`):
  - `auth/` — three ports (`AuthApiPort`, `AuthCookieStorePort`,
    `AuthNavigationPort`), use cases (`login`, `register`, `logout`,
    `refresh-session`, `route-access.policy`), presentation adapters
    (`login-form`, `register-form`), infrastructure adapters
    (`fetch-auth-api`, `next-auth-cookie-store`, `browser-auth-cookie-store`,
    `next-auth-navigation`).

**Composition roots** (api: `apps/api/src/app.module.ts` → `AuthContextModule` +
`UsersContextModule`; web: `apps/web/src/middleware.ts` + `apps/web/src/app/actions/*` +
page segments under `apps/web/src/app/(auth)/*`) wire every port binding
explicitly. Grep for `bind:` in the `*.context.module.ts` files to see the
wiring table for each context.

**Prisma boundary.** `apps/api/src/infra/` owns the `PrismaClient`. Only
infrastructure adapters import it; use cases see a typed port. `apps/web`
MUST NOT import Prisma — enforced by ESLint and `AGENTS.md`.

## Consequences

Positive:

- New features land as a single context folder. The full slice (domain +
  use cases + adapters + tests) ships together.
- Domain code is framework-free, so it can be unit-tested with zero mocks
  and survives framework swaps.
- The api and the web share a vocabulary (`domain/`, `application/`,
  `infrastructure/`, composition root), which makes cross-app refactors
  mechanical.
- Architecture rules are machine-checked, not review-checked.

Negative / trade-offs:

- A bounded context is a heavier unit of change than a technical folder.
  Tiny one-file features now require the four-layer split, which can feel
  ceremonial for trivial surfaces. Per `AGENTS.md`, DDD is applied
  pragmatically — purely presentational or declarative code does not get
  domain abstractions it does not need.
- The vertical layout duplicates the context name across nested paths
  (`contexts/users/infrastructure/http/users-http.controller.ts`). We accept
  the verbosity because it makes the slice self-describing.
- Cross-context reuse (e.g. `User` entity used by both users and auth)
  happens via `packages/contracts` or through ports — never by importing a
  sibling context's domain directly. This is enforced by ESLint.

## Enforcement

- ESLint per-app configs (`apps/api/eslint.config.mjs`,
  `apps/web/eslint.config.mjs`) forbid domain/application files from
  importing infrastructure, frameworks, or Prisma. A forbidden import makes
  the lint step fail.
- `AGENTS.md` global rules + [`apps/api/AGENTS.md`](../apps/api/AGENTS.md) +
  [`apps/web/AGENTS.md`](../apps/web/AGENTS.md) document the layer rules
  per app. Any local rule that weakens these is forbidden.
- The aggregate coverage gate
  ([ADR-013](./ADR-013-independent-80-percent-coverage.md)) implicitly
  catches lazy layering — if an adapter drifts into use cases, the inner
  layer's coverage drops and the gate fails.
- The no-skipped-tests harness check (`INC-012`) plus the architecture
  grep auto-check ensure that "I built a context folder but didn't test it"
  cannot ship green.
