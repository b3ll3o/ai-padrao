# ai-padrao Blueprint Monorepo — Design Spec

**Date**: 2026-08-04
**Status**: Approved (design), pending implementation plan
**Owner**: leo
**Project**: `ai-padrao` (blueprint for derived projects)

---

## 1. Purpose

Transform the empty `ai-padrao` repository into a **production-grade monorepo blueprint** that other projects will copy/extend. The blueprint must:

1. Bootstrap a full Next.js + NestJS + PostgreSQL stack with **one command** (`pnpm up` via Docker).
2. Demonstrate the architectural patterns every derived project should follow.
3. Encode the **SDD (Specification-Driven Development)** workflow as an **enforced project rule**, so every feature or behavior change in any derived project goes through the same controlled process.

This repository is **not** itself a product — it is a *template*. Each downstream project clones it, renames it, and adds features via the SDD flow.

---

## 2. Architecture Overview

### 2.1 Monorepo structure

Single repository managed by **pnpm workspaces + Turborepo 2**. One root `docker-compose.yml` orchestrates 5 services.

| Service    | Image / Build           | Host port | Responsibility                          |
|------------|-------------------------|-----------|-----------------------------------------|
| `postgres` | `postgres:16-alpine`    | 5432      | Relational database                     |
| `api`      | local build (NestJS)    | 3001      | REST API + JWT auth + OpenTelemetry     |
| `web`      | local build (Next.js)   | 3000      | Frontend app                            |
| `mailhog`  | `mailhog/mailhog:v1.0.1` | 18025/11125 (host) → 8025/1025 (container) | SMTP catcher for dev email flows        |
| `otel-collector` | `otel/opentelemetry-collector-contrib` | 4317/4318 | OTLP receiver for traces & metrics |

### 2.2 Directory layout

```
ai-padrao/
├── AGENTS.md                 # SDD rule (short, cross-tool)
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .openspec/                # SDD workflow lives here
│   ├── AGENTS.md             # Detailed SDD workflow
│   └── templates/
│       ├── proposal.md
│       ├── tasks.md
│       ├── design.md
│       └── spec.md
├── apps/
│   ├── api/                  # NestJS 11 + Fastify
│   │   ├── src/
│   │   │   ├── modules/      # auth, users, health
│   │   │   ├── common/       # filters, interceptors, decorators, guards
│   │   │   ├── infra/        # prisma, otel, config
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── test/             # e2e (Supertest)
│   │   └── Dockerfile.dev    # Dockerfile.prod also exists
│   └── web/                  # Next.js 15 (App Router)
│       ├── src/app/          # routes
│       ├── src/components/
│       ├── src/lib/          # api client, auth helpers, env
│       ├── middleware.ts     # token refresh + redirect
│       └── Dockerfile.dev
├── packages/
│   ├── db/                   # @ai-padrao/db (Prisma client re-export)
│   ├── contracts/            # @ai-padrao/contracts (Zod schemas)
│   ├── ui/                   # @ai-padrao/ui (shadcn components)
│   ├── config-eslint/        # @ai-padrao/config-eslint
│   ├── config-tsconfig/      # @ai-padrao/config-tsconfig
│   └── config-tailwind/      # @ai-padrao/config-tailwind
└── infra/
    └── otel-collector.yaml   # OTel pipeline config (dev: console exporter)
```

### 2.3 Principles

- **Schema ownership**: `apps/api` owns `schema.prisma`; `packages/db` only re-exports the generated client. `apps/web` MUST NOT import Prisma directly.
- **Single validation source**: every request/response flows through Zod schemas in `@ai-padrao/contracts`. Backend validates at the boundary; frontend uses the same schemas for forms (`zodResolver`).
- **Type-safe env**: `@nestjs/config` + Zod in API; `zod` parsing `process.env` in web. `.env.example` versioned, `.env` gitignored.
- **Stateless auth surface**: API speaks JWT; web stores refresh in `httpOnly` cookie. No tokens in `localStorage`.

---

## 3. Tech Stack

| Layer                  | Choice                                | Notes |
|------------------------|---------------------------------------|-------|
| Monorepo               | pnpm 9 + Turborepo 2                  | Cache, parallelism |
| Runtime                | Node 22 LTS                           | Nest 11 + Next 15 compatible |
| Backend framework      | NestJS 11 + Fastify adapter           | ~2× faster than Express |
| API validation         | `nestjs-zod` + `zod`                  | Single schema = runtime + types |
| ORM                    | Prisma 6                              | Declarative schema, versioned migrations |
| Auth                   | `@nestjs/jwt` + `@nestjs/throttler`   | JWT access 15m + rotated refresh in httpOnly cookie |
| Password hashing       | `argon2`                              | Argon2id, OWASP recommended |
| Observability          | OpenTelemetry SDK + OTel Collector    | Traces + metrics, OTLP export |
| API docs               | `@nestjs/swagger` at `/docs`          | Generated from Zod via plugin |
| Backend testing        | Jest + Supertest                      | Unit + e2e |
| Frontend framework     | Next.js 15 (App Router)               | RSC by default |
| Styling                | Tailwind CSS 4 + shadcn/ui            | In `packages/ui` |
| HTTP client            | `ky` + TanStack Query 5               | Auto-refresh on 401 |
| Forms                  | `react-hook-form` + `@hookform/resolvers/zod` | Shares `@ai-padrao/contracts` |
| Lint/format            | ESLint 9 (flat config) + Prettier 3   | Shared via `packages/config-eslint` |
| Pre-commit             | Husky + lint-staged                   | Lint + typecheck changed packages |
| Commits                | Commitlint + Conventional Commits     | Enforced |

### Explicitly NOT included in MVP

- ❌ CI/CD pipeline (GitHub Actions) — added later per project
- ❌ Deploy targets (Vercel/Fly/Render) — each derived project chooses
- ❌ i18n — added when needed
- ❌ Admin panel / granular RBAC — only basic auth in MVP
- ❌ Redis / cache — pluggable via BullMQ later
- ❌ Hexagonal layers in API — keeping MVP simple; can be layered in later

---

## 4. SDD Workflow (Enforced Rule)

### 4.1 The rule

**Every new feature or behavior change MUST follow the SDD flow below. No exceptions.** Pure cosmetic work (refactors, typos, dep bumps without behavior impact) does not require OpenSpec but MUST use Conventional Commits.

### 4.2 Canonical flow

```
1. PROBLEM    → define the business problem (not the technical solution)
       ↓
2. PROPOSAL   → .openspec/changes/<feature>/
                 ├── proposal.md     # why, what, impact, out-of-scope
                 ├── tasks.md        # executable checklist (1, 2, 3, ...)
                 ├── design.md       # relevant technical decisions
                 └── specs/<area>/spec.md   # SHALL/SHOULD/MAY deltas
       ↓
3. REVIEW     → human approves proposal BEFORE any code
       ↓
4. BUILD      → execute tasks in order; small commits referencing "task N"
       ↓
5. ARCHIVE    → move from .openspec/changes/ → .openspec/specs/ (git preserves history)
```

### 4.3 Restrictions

- **Forbidden** to open a PR with behavior changes that lacks a `.openspec/changes/<feature>/` folder.
- **Forbidden** to start code while `proposal.md` is not approved by a human.
- Each `proposal.md` MUST contain: **Why**, **What changes**, **Impact** (user/system/other features), **Out of scope**, **Risks**.
- Each `specs/<area>/spec.md` uses **SHALL/SHOULD/MAY** semantics (RFC 2119) — no ambiguity.
- `tasks.md` MUST be executable as a checklist; each item has a clear definition of done.

### 4.4 Where the rule lives

| File                          | Content                                  | Read by |
|-------------------------------|------------------------------------------|---------|
| `AGENTS.md` (root)            | Short rule + pointer to `.openspec/AGENTS.md` | Claude Code, Cursor, Gemini, Codex |
| `.openspec/AGENTS.md`         | Detailed workflow, templates, checklist  | Claude Code (skills), humans |
| `.cursor/rules/sdd.mdc`       | Cursor-friendly version of the rule      | Cursor |

### 4.5 Templates shipped in MVP

- `.openspec/templates/proposal.md`
- `.openspec/templates/tasks.md`
- `.openspec/templates/design.md`
- `.openspec/templates/spec.md`

---

## 5. Apps & Packages — Internal Structure

### 5.1 `apps/api` (NestJS 11 + Fastify)

```
apps/api/src/
├── main.ts                       # bootstrap Fastify, OTel, Swagger
├── app.module.ts
├── common/
│   ├── filters/                  # HttpExceptionFilter (ZodError → 400)
│   ├── interceptors/             # LoggingInterceptor (request-id + OTel span)
│   ├── decorators/               # @CurrentUser(), @Public()
│   └── guards/                   # JwtAuthGuard, RefreshGuard
├── infra/
│   ├── prisma/                   # PrismaService (DI)
│   ├── otel/                     # OTel SDK setup
│   └── config/                   # typed env config (zod)
└── modules/
    ├── auth/                     # controller, service, strategies, dto
    ├── users/                    # controller, service, repository
    └── health/                   # liveness + readiness (DB check)
```

- Validation via `nestjs-zod`: Zod DTOs → 400 with structured errors.
- Swagger UI at `GET /docs`, generated from Zod.
- OpenTelemetry instrumentation: NestJS HTTP + Prisma.
- Health endpoints: `GET /health` (liveness), `GET /health/ready` (DB ping).
- Auth endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.
- User endpoints: `GET /users` (admin), `GET /users/:id`, `PATCH /users/:id`, `DELETE /users/:id`.
- Tests: `*.spec.ts` (unit) + `test/` (e2e Supertest).

### 5.2 `apps/web` (Next.js 15 App Router)

```
apps/web/src/
├── app/
│   ├── (public)/                 # /login, /register
│   ├── (authed)/                 # /dashboard, /profile (auth-guarded layout)
│   ├── api/                      # internal route handlers (BFF if needed)
│   ├── layout.tsx
│   └── providers.tsx             # QueryClientProvider, ThemeProvider
├── components/                   # app-specific components
├── lib/
│   ├── api-client.ts             # ky + auto-refresh on 401
│   ├── auth.ts                   # server actions
│   └── env.ts                    # zod-validated process.env
└── middleware.ts                 # refresh + redirect
```

- Server Components by default; `'use client'` only where needed.
- Refresh token in `httpOnly` cookie; access token in memory (short-lived).
- API client auto-refreshes on 401 once before retrying.
- Forms use `react-hook-form` + `zodResolver` against `@ai-padrao/contracts`.

### 5.3 `packages/db`

- Declares dependency on `@prisma/client`.
- `src/index.ts` re-exports the generated client.
- Build step (`pnpm --filter @ai-padrao/db build`) generates the client from `apps/api/prisma/schema.prisma`.

### 5.4 `packages/contracts`

```
packages/contracts/src/
├── auth.ts                       # RegisterInput, LoginInput, RefreshInput (Zod)
├── users.ts                      # UserDto, UpdateUserInput (Zod)
└── index.ts
```

Each schema exports both the schema and `z.infer<typeof X>` type.

### 5.5 `packages/ui`

- shadcn/ui components with shared Tailwind preset.
- Exports `<Button>`, `<Input>`, `<Form>`, `<Dialog>`, etc.
- Web consumes via `@ai-padrao/ui`.

### 5.6 `packages/config-*`

Pure config files: `eslint.config.mjs`, `tsconfig.base.json`, `tailwind.preset.ts`. Apps extend them.

---

## 6. Docker & Orchestration

### 6.1 `docker-compose.yml` (structure)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment: { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB }
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: pg_isready

  api:
    build: { context: ./apps/api, dockerfile: Dockerfile.dev }
    command: pnpm run start:dev
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      otel-collector: { condition: service_started }
    ports: ["3001:3001"]
    volumes:
      - ./apps/api/src:/app/apps/api/src
      - ./packages:/app/packages
      - api_node_modules:/app/apps/api/node_modules
      - api_root_node_modules:/app/node_modules

  web:
    build: { context: ./apps/web, dockerfile: Dockerfile.dev }
    command: pnpm run dev
    env_file: .env
    depends_on: [api]
    ports: ["3000:3000"]
    volumes:
      - ./apps/web/src:/app/apps/web/src
      - ./packages:/app/packages
      - web_node_modules:/app/apps/web/node_modules
      - web_root_node_modules:/app/node_modules

  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.110.0
    command: ["--config=/etc/otel/config.yaml"]
    volumes: [./infra/otel-collector.yaml:/etc/otel/config.yaml:ro]
    ports: ["4317:4317", "4318:4318"]

  mailhog:
    image: mailhog/mailhog:v1.0.1
    ports: ["11125:1025", "18025:8025"]

volumes:
  pgdata: {}
  api_node_modules: {}
  web_node_modules: {}
  api_root_node_modules: {}
  web_root_node_modules: {}
```

### 6.2 Decisions

- **Two Dockerfiles per app**: `Dockerfile.dev` (HMR via volume mounts) and `Dockerfile.prod` (multi-stage optimized). Production compose is a separate file, not part of MVP.
- **Web prod image uses Next.js `output: 'standalone'`**: `apps/web/next.config.ts` (Task 17) **must** set `output: 'standalone'`. The runtime stage copies `.next/standalone/` + `.next/static` + `public/` and runs `node apps/web/server.js`. This is what makes workspace deps (`@ai-padrao/contracts`, `@ai-padrao/ui`) resolve in the image — copying `apps/web/node_modules` instead would leave dangling symlinks into an absent `packages/` and ship dev deps.
- **Named volumes for `node_modules`**: prevents host bind mounts from clobbering container modules. Each service gets its *own* volumes (`api_root_node_modules`, `web_root_node_modules`) — a shared `/app/node_modules` volume is populated by whichever container mounts it last.
- **`infra/otel-collector.yaml`**: dev exporter is `debug` (console); prod swaps to OTLP/HTTP backend.
- **`.env.example`** versioned; documents `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `WEB_ORIGIN`, `API_INTERNAL_URL`.
- **Root scripts** (`package.json`): `pnpm up`, `pnpm down`, `pnpm logs`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:reset`, `pnpm test`, `pnpm lint`, `pnpm typecheck`.
- **Prisma migrations** run inside the api container: `pnpm db:migrate` → `docker compose exec api pnpm prisma migrate dev`.

---

## 7. Example Feature Flow (Walkthrough)

Adding "Forgot password" — the **first real feature after the MVP ships**, demonstrating the SDD flow.

### 7.1 `proposal.md` at `.openspec/changes/forgot-password/`

- **Why**: users cannot recover access if they forget their password.
- **What changes**: `POST /auth/forgot-password` + `POST /auth/reset-password`; email with reset link via MailHog (dev); new table `password_reset_tokens`.
- **Impact**: API adds 2 endpoints; web adds 2 pages; Prisma schema gains 1 model.
- **Out of scope**: 2FA, recovery codes, SMS.
- **Risks**: email rate-limiting (mitigated with `@nestjs/throttler`), token reuse (mitigated with `used_at` column).

### 7.2 `design.md`

Hash the reset token with SHA-256 in the DB; TTL 1h; invalidate on use.

### 7.3 `tasks.md`

- [ ] 1. Add `PasswordResetToken` model to Prisma schema
- [ ] 2. Migration + regenerate client
- [ ] 3. Add Zod schemas in `packages/contracts/auth.ts`
- [ ] 4. Implement `AuthService.requestPasswordReset()` and `.resetPassword()`
- [ ] 5. Endpoints in controller + Swagger annotations
- [ ] 6. Email service with nodemailer (SMTP → MailHog in dev)
- [ ] 7. Pages `/forgot-password` and `/reset-password` in web
- [ ] 8. Unit tests (service) + e2e tests (controller)
- [ ] 9. Move spec from `changes/` → `specs/auth/`
- [ ] 10. Update `AGENTS.md` if the flow changed

### 7.4 Execution

Each task → one commit (`feat(api): task 1 - add PasswordResetToken model`). PR aggregates everything.

### 7.5 Archive

After merge, move `.openspec/changes/forgot-password/` → `.openspec/specs/auth/forgot-password.md` (git preserves history).

---

## 8. Definition of Done (MVP)

The blueprint is "done" when **all** of the following are true:

- [ ] `docker compose up` brings up all 5 services without error
- [ ] `pnpm db:migrate && pnpm db:seed` creates schema + seed data
- [ ] `curl http://localhost:3001/health` returns 200 with Postgres status
- [ ] `curl http://localhost:3001/docs` returns Swagger UI
- [ ] `POST http://localhost:3001/auth/register` creates a user
- [ ] `POST http://localhost:3001/auth/login` returns access JWT and sets refresh cookie
- [ ] `GET http://localhost:3001/auth/me` (with Bearer token) returns the user
- [ ] `http://localhost:3000` loads the home page; login form works end-to-end
- [ ] OTel collector receives traces (`docker compose logs otel-collector` shows activity)
- [ ] `pnpm test` runs unit + e2e suites green on api and web
- [ ] `pnpm lint` and `pnpm typecheck` pass across all packages
- [ ] `AGENTS.md` (root) documents the SDD rule
- [ ] `.openspec/AGENTS.md` documents the detailed workflow
- [ ] `.openspec/templates/` contains the 4 templates
- [ ] Husky + lint-staged run on pre-commit (verified with a test commit)
- [ ] `README.md` explains how to run the project in 5 minutes

---

## 9. Out of Scope (for this spec)

The following are **explicitly deferred** and tracked as future specs in their own right:

- CI/CD pipelines (GitHub Actions, GitLab CI, etc.)
- Production deployment configurations
- Internationalization (i18n) framework
- Role-based access control beyond basic auth
- Caching layer (Redis) and async job processing (BullMQ)
- Hexagonal architecture enforcement inside the API
- Visual regression testing setup
- E2E browser tests (Playwright) — not in MVP; tracked as a future spec

---

## 10. Risks & Mitigations

| Risk                                                  | Mitigation |
|-------------------------------------------------------|------------|
| `pnpm` not installed on dev machines                  | Document `corepack enable` in README; pin pnpm via `packageManager` field |
| Bind-mount performance hit on macOS                   | Use `:cached` flag on dev volumes; document Docker Desktop file-sharing settings |
| OpenTelemetry overhead in dev                         | Use sampling rate 1.0 in dev, configurable in prod; SDK can be disabled via env var |
| Zod + Prisma schema duplication (entities defined twice) | Keep contracts minimal (DTOs only); DB models can diverge from API DTOs intentionally |
| Husky breaks Windows devs                             | Document git-bash requirement; consider `lefthook` as alternative in future |
| Derived projects drift from blueprint                 | Periodic rebasing script + reference to blueprint tag in derived repos |

---

## 11. Success Criteria

The blueprint is successful when:

1. A new developer can clone, run `pnpm install`, `pnpm up`, and have a working stack in under 5 minutes (after Docker is installed).
2. Creating a new feature follows the SDD flow without thinking — the templates and `AGENTS.md` make it obvious.
3. At least 2 derived projects are successfully bootstrapped from this blueprint within 6 months of completion.
4. Test + lint + typecheck run on pre-commit and never fail in `main`.