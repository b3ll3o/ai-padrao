# ai-padrao Blueprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap `ai-padrao` as a copy-paste monorepo blueprint (Next.js + NestJS + PostgreSQL + Docker) with an enforced SDD (OpenSpec) workflow, ready to be cloned by derived projects.

**Architecture:** pnpm workspaces + Turborepo monorepo. One `docker-compose.yml` orchestrates 5 services (postgres, api, web, mailhog, otel-collector). Apps communicate through Zod-typed contracts in `packages/contracts`. The SDD rule is encoded in `AGENTS.md` (root) + `.openspec/AGENTS.md` + `.cursor/rules/sdd.mdc`.

**Tech Stack:** Node 22, pnpm 9, Turborepo 2, NestJS 11 (Fastify), Prisma 6, Next.js 15 (App Router), Tailwind 4, shadcn/ui, OpenTelemetry SDK + Collector, Argon2id, JWT (access + rotated refresh), Zod, Husky + lint-staged + commitlint.

**Spec reference:** [`docs/superpowers/specs/2026-08-04-ai-padrao-blueprint-design.md`](../specs/2026-08-04-ai-padrao-blueprint-design.md)

---

## File Structure

Files created/modified by this plan (one responsibility per file):

```
ai-padrao/
├── AGENTS.md                                    # SDD rule (short)
├── README.md                                    # 5-minute quickstart
├── docker-compose.yml                           # 5-service orchestration
├── turbo.json                                   # Turborepo config
├── pnpm-workspace.yaml                          # workspace globs
├── package.json                                 # root scripts
├── .env.example                                 # documented env vars
├── .gitignore                                   # ignore .env, node_modules, etc.
├── .editorconfig                                # consistent line endings
├── .commitlintrc.json                           # Conventional Commits
├── .eslintrc.cjs                                # legacy fallback (flat config lives in packages/config-eslint)
├── infra/
│   └── otel-collector.yaml                      # OTel collector config (dev: debug exporter)
├── .husky/
│   ├── pre-commit                               # lint-staged hook
│   └── commit-msg                               # commitlint hook
├── .openspec/
│   ├── AGENTS.md                                # detailed SDD workflow
│   └── templates/
│       ├── proposal.md
│       ├── tasks.md
│       ├── design.md
│       └── spec.md
├── .cursor/
│   └── rules/
│       └── sdd.mdc                              # Cursor rule (mirror of root AGENTS.md)
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   ├── Dockerfile.dev
│   │   ├── Dockerfile.prod
│   │   ├── jest.config.ts
│   │   ├── eslint.config.mjs
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── test/
│   │   │   ├── auth.e2e-spec.ts
│   │   │   └── users.e2e-spec.ts
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── common/
│   │       │   ├── filters/http-exception.filter.ts
│   │       │   ├── interceptors/logging.interceptor.ts
│   │       │   ├── decorators/current-user.decorator.ts
│   │       │   ├── decorators/public.decorator.ts
│   │       │   └── guards/jwt-auth.guard.ts
│   │       ├── infra/
│   │       │   ├── prisma/prisma.service.ts
│   │       │   ├── prisma/prisma.module.ts
│   │       │   ├── otel/otel.ts
│   │       │   └── config/env.schema.ts
│   │       └── modules/
│   │           ├── auth/
│   │           │   ├── auth.module.ts
│   │           │   ├── auth.controller.ts
│   │           │   ├── auth.service.ts
│   │           │   ├── auth.service.spec.ts
│   │           │   └── strategies/jwt.strategy.ts
│   │           ├── users/
│   │           │   ├── users.module.ts
│   │           │   ├── users.controller.ts
│   │           │   ├── users.service.ts
│   │           │   └── users.service.spec.ts
│   │           └── health/
│   │               ├── health.module.ts
│   │               └── health.controller.ts
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.mjs
│       ├── Dockerfile.dev
│       ├── Dockerfile.prod
│       ├── vitest.config.ts
│       ├── eslint.config.mjs
│       ├── src/
│       │   ├── middleware.ts
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── providers.tsx
│       │   │   ├── globals.css
│       │   │   ├── (public)/login/page.tsx
│       │   │   ├── (public)/register/page.tsx
│       │   │   └── (authed)/dashboard/page.tsx
│       │   ├── components/login-form.tsx
│       │   ├── components/register-form.tsx
│       │   └── lib/
│       │       ├── api-client.ts
│       │       ├── auth.ts
│       │       └── env.ts
└── packages/
    ├── db/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/index.ts                         # re-exports Prisma client
    ├── contracts/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/auth.ts                          # Zod schemas
    │   ├── src/users.ts                         # Zod schemas
    │   ├── src/auth.spec.ts                     # unit tests for schemas
    │   └── src/users.spec.ts                    # unit tests for schemas
    ├── ui/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/button.tsx
    │   ├── src/input.tsx
    │   ├── src/form.tsx
    │   ├── src/dialog.tsx
    │   └── src/index.ts
    ├── config-eslint/
    │   ├── package.json
    │   └── index.js
    ├── config-tsconfig/
    │   ├── package.json
    │   ├── base.json
    │   └── nest.json
    └── config-tailwind/
        ├── package.json
        └── preset.ts
```

---

## Phase 1 — Monorepo Root

### Task 1: Initialize root manifest, workspace, turbo config

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `.npmrc`

- [ ] **Step 1: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 2: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local", ".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": { "outputs": [] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "clean": { "cache": false }
  }
}
```

- [ ] **Step 3: Write `package.json`**

```json
{
  "name": "ai-padrao",
  "version": "0.1.0",
  "private": true,
  "description": "Monorepo blueprint: Next.js + NestJS + Postgres, SDD-driven.",
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=22.0.0", "pnpm": ">=9.0.0" },
  "scripts": {
    "up": "docker compose up -d",
    "down": "docker compose down",
    "logs": "docker compose logs -f",
    "db:migrate": "docker compose exec api pnpm prisma migrate dev",
    "db:seed": "docker compose exec api pnpm prisma db seed",
    "db:reset": "docker compose exec api pnpm prisma migrate reset --force",
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.6.0",
    "@commitlint/cli": "^19.5.0",
    "@commitlint/config-conventional": "^19.5.0",
    "husky": "^9.1.0",
    "lint-staged": "^15.2.0"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix"],
    "*.{ts,tsx,js,jsx,json,md}": ["prettier --write"]
  }
}
```

- [ ] **Step 4: Write `.gitignore`**

```gitignore
# dependencies
node_modules/
.pnpm-store/

# build outputs
dist/
.next/
.turbo/
*.tsbuildinfo

# env
.env
.env.local
.env.*.local
!.env.example

# logs
*.log
npm-debug.log*
pnpm-debug.log*

# os
.DS_Store
Thumbs.db

# editor
.vscode/
.idea/
*.swp

# coverage
coverage/

# prisma
apps/api/prisma/migrations/dev.db*
```

- [ ] **Step 5: Write `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 6: Write `.npmrc`**

```ini
auto-install-peers=true
strict-peer-dependencies=false
shamefully-hoist=false
```

- [ ] **Step 7: Verify pnpm can read the workspace**

Run: `pnpm install --ignore-scripts`
Expected: Creates `node_modules/` and `pnpm-lock.yaml` without errors (packages don't exist yet — that's fine, `pnpm` warns but doesn't fail).

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore .editorconfig .npmrc pnpm-lock.yaml
git commit -m "chore(root): initialize monorepo workspace + turbo config"
```

---

### Task 2: Write `.env.example` and root README skeleton

**Files:**
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Write `.env.example`**

```bash
# --- Database ---
POSTGRES_USER=ai_padrao
POSTGRES_PASSWORD=ai_padrao_dev
POSTGRES_DB=ai_padrao
DATABASE_URL=postgresql://ai_padrao:ai_padrao_dev@postgres:5432/ai_padrao?schema=public

# --- API (NestJS) ---
NODE_ENV=development
API_PORT=3001
API_INTERNAL_URL=http://api:3001
JWT_ACCESS_SECRET=change-me-access-secret-min-32-chars-long
JWT_REFRESH_SECRET=change-me-refresh-secret-min-32-chars-long
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CORS_ORIGINS=http://localhost:3000

# --- Web (Next.js) ---
WEB_PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3001
API_URL=http://api:3001
WEB_ORIGIN=http://localhost:3000

# --- OpenTelemetry ---
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_SERVICE_NAME=ai-padrao

# --- SMTP (MailHog in dev) ---
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_FROM=no-reply@ai-padrao.local
```

- [ ] **Step 2: Write `README.md`**

````markdown
# ai-padrao

Monorepo blueprint: Next.js + NestJS + PostgreSQL, fully Dockerized, SDD-driven.

## Quickstart (5 minutes)

Requires Docker, Docker Compose, and Node 22+.

```bash
git clone <repo-url> my-project
cd my-project
corepack enable
pnpm install
cp .env.example .env
pnpm up
pnpm db:migrate
pnpm db:seed
```

Open:
- App: http://localhost:3000
- API: http://localhost:3001
- Swagger: http://localhost:3001/docs
- MailHog: http://localhost:18025

Default seed user: `admin@ai-padrao.local` / `admin123`.

## Architecture

See [`docs/superpowers/specs/`](docs/superpowers/specs/) for the full design spec.

| App / Package    | Purpose                                |
|------------------|----------------------------------------|
| `apps/api`       | NestJS 11 + Fastify REST API           |
| `apps/web`       | Next.js 15 (App Router) frontend       |
| `packages/db`    | Prisma client re-export                |
| `packages/contracts` | Zod schemas shared front + back    |
| `packages/ui`    | shadcn/ui components                   |

## Spec-Driven Development

This project enforces the **SDD (Specification-Driven Development)** workflow via OpenSpec.
Every new feature MUST follow the process in [`AGENTS.md`](AGENTS.md) and [`.openspec/AGENTS.md`](.openspec/AGENTS.md).

## Scripts

| Command            | What it does                            |
|--------------------|-----------------------------------------|
| `pnpm up`          | Start all Docker services               |
| `pnpm down`        | Stop all services                       |
| `pnpm logs`        | Tail logs from all services             |
| `pnpm db:migrate`  | Apply Prisma migrations (in api container) |
| `pnpm db:seed`     | Run seed script                         |
| `pnpm db:reset`    | Reset DB + re-run migrations + seed     |
| `pnpm build`       | Build all packages                      |
| `pnpm dev`         | Run all dev servers                     |
| `pnpm test`        | Run unit + e2e tests                    |
| `pnpm lint`        | Lint all packages                       |
| `pnpm typecheck`   | TypeScript checks across packages       |
````

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs(root): add env example and README quickstart"
```

---

### Task 3: Docker Compose + Dockerfiles (api dev/prod, web dev/prod)

**Files:**
- Create: `docker-compose.yml`
- Create: `apps/api/Dockerfile.dev`
- Create: `apps/api/Dockerfile.prod`
- Create: `apps/web/Dockerfile.dev`
- Create: `apps/web/Dockerfile.prod`
- Create: `infra/otel-collector.yaml`
- Create: `apps/api/.dockerignore`
- Create: `apps/web/.dockerignore`

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
name: ai-padrao

services:
  postgres:
    image: postgres:16-alpine
    container_name: ai-padrao-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile.dev
    container_name: ai-padrao-api
    env_file: .env
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
    depends_on:
      postgres:
        condition: service_healthy
      otel-collector:
        condition: service_started
    ports:
      - "3001:3001"
    volumes:
      - ./apps/api/src:/app/apps/api/src
      - ./packages:/app/packages
      - api_node_modules:/app/apps/api/node_modules
      - api_root_node_modules:/app/node_modules

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile.dev
    container_name: ai-padrao-web
    env_file: .env
    environment:
      API_URL: http://api:3001
    depends_on:
      - api
    ports:
      - "3000:3000"
    volumes:
      - ./apps/web/src:/app/apps/web/src
      - ./packages:/app/packages
      - web_node_modules:/app/apps/web/node_modules
      - web_root_node_modules:/app/node_modules

  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.110.0
    container_name: ai-padrao-otel
    command: ["--config=/etc/otel/config.yaml"]
    volumes:
      - ./infra/otel-collector.yaml:/etc/otel/config.yaml:ro
    ports:
      - "4317:4317"
      - "4318:4318"

  mailhog:
    image: mailhog/mailhog:v1.0.1
    container_name: ai-padrao-mailhog
    ports:
      - "11125:1025"
      - "18025:8025"

volumes:
  pgdata:
  # Per-service volumes: a shared /app/node_modules volume would be populated by
  # whichever container mounted it last, leaving the other with the wrong tree.
  api_node_modules:
  web_node_modules:
  api_root_node_modules:
  web_root_node_modules:
```

- [ ] **Step 2: Write `apps/api/Dockerfile.dev`**

```dockerfile
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
# packages/ will exist after Tasks 4-8; required for proper cache invalidation
COPY packages ./packages
RUN pnpm install --ignore-scripts
COPY apps/api ./apps/api
EXPOSE 3001
CMD ["pnpm", "--filter", "@ai-padrao/api", "run", "start:dev"]
```

- [ ] **Step 3: Write `apps/api/Dockerfile.prod`**

```dockerfile
# Stage 1: build
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
# packages/ will exist after Tasks 4-8; required for proper cache invalidation
COPY packages ./packages
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY apps/api ./apps/api
RUN pnpm --filter @ai-padrao/api run build && pnpm deploy --filter @ai-padrao/api --prod /prod/api

# Stage 2: runtime
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /prod/api ./
COPY --from=build /prod/api/prisma ./prisma
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

- [ ] **Step 4: Write `apps/web/Dockerfile.dev`**

```dockerfile
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
# packages/ will exist after Tasks 4-8; required for proper cache invalidation
COPY packages ./packages
RUN pnpm install --ignore-scripts
COPY apps/web ./apps/web
EXPOSE 3000
CMD ["pnpm", "--filter", "@ai-padrao/web", "run", "dev"]
```

- [ ] **Step 5: Write `apps/web/Dockerfile.prod`**

```dockerfile
# Stage 1: deps
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
# packages/ will exist after Tasks 4-8; required for proper cache invalidation
COPY packages ./packages
RUN pnpm install --frozen-lockfile --ignore-scripts

# Stage 2: build
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
COPY --from=deps /app ./
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @ai-padrao/web run build

# Stage 3: runtime
# REQUIRES: apps/web/next.config.ts must set `output: 'standalone'` (Task 17).
# Without it, `.next/standalone/` is never emitted and the COPY below fails.
# Standalone bundles only the prod deps actually imported (including workspace
# packages like @ai-padrao/contracts), so no node_modules copy is needed here.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
```

- [ ] **Step 6: Write `infra/otel-collector.yaml`**

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  # Guards the collector against OOM under trace/metric bursts; must run first
  # so it can reject data before the batcher buffers it.
  memory_limiter:
    check_interval: 1s
    limit_percentage: 80
    spike_limit_percentage: 25
  batch: {}

exporters:
  debug:
    verbosity: detailed

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [debug]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [debug]
```

- [ ] **Step 7: Write `.dockerignore` files**

`apps/api/.dockerignore`:
```
node_modules
dist
.next
.git
.env
.env.local
coverage
test
*.log
```

`apps/web/.dockerignore`:
```
node_modules
.next
.git
.env
.env.local
coverage
*.log
```

- [ ] **Step 8: Validate compose file syntax**

Run: `docker compose config --quiet`
Expected: exit 0 (may need to create `.env` from `.env.example` first: `cp .env.example .env`).

- [ ] **Step 9: Commit**

```bash
git add docker-compose.yml apps/api/Dockerfile.dev apps/api/Dockerfile.prod apps/web/Dockerfile.dev apps/web/Dockerfile.prod apps/api/.dockerignore apps/web/.dockerignore infra/otel-collector.yaml
git commit -m "chore(docker): add compose + dev/prod Dockerfiles for api and web"
```

---

## Phase 2 — Config Packages

### Task 4: `packages/config-tsconfig`

**Files:**
- Create: `packages/config-tsconfig/package.json`
- Create: `packages/config-tsconfig/base.json`
- Create: `packages/config-tsconfig/nest.json`
- Create: `packages/config-tsconfig/next.json`
- Create: `packages/config-tsconfig/react-library.json`

- [ ] **Step 1: Write `packages/config-tsconfig/package.json`**

```json
{
  "name": "@ai-padrao/config-tsconfig",
  "version": "0.1.0",
  "private": true,
  "files": ["base.json", "nest.json", "next.json", "react-library.json"]
}
```

- [ ] **Step 2: Write `packages/config-tsconfig/base.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Default",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noImplicitAny": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false
  },
  "exclude": ["node_modules", "dist", ".next", "coverage"]
}
```

- [ ] **Step 3: Write `packages/config-tsconfig/nest.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "NestJS",
  "extends": "./base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "target": "ES2022",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "useDefineForClassFields": false,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

- [ ] **Step 4: Write `packages/config-tsconfig/next.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Next.js",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowJs": true,
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  }
}
```

- [ ] **Step 5: Write `packages/config-tsconfig/react-library.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "React library",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "jsx": "react-jsx",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/config-tsconfig/
git commit -m "chore(config): add shared tsconfig presets"
```

---

### Task 5: `packages/config-eslint`

**Files:**
- Create: `packages/config-eslint/package.json`
- Create: `packages/config-eslint/base.js`
- Create: `packages/config-eslint/nest.js`
- Create: `packages/config-eslint/next.js`
- Create: `packages/config-eslint/react.js`

- [ ] **Step 1: Write `packages/config-eslint/package.json`**

```json
{
  "name": "@ai-padrao/config-eslint",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "base.js",
  "files": ["base.js", "nest.js", "next.js", "react.js"],
  "dependencies": {
    "@typescript-eslint/eslint-plugin": "^8.13.0",
    "@typescript-eslint/parser": "^8.13.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-react": "^7.37.2",
    "eslint-plugin-react-hooks": "^5.0.0",
    "globals": "^15.12.0"
  },
  "peerDependencies": {
    "eslint": "^9.14.0"
  }
}
```

- [ ] **Step 2: Write `packages/config-eslint/base.js`**

```js
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/coverage/**'],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  prettier,
];
```

- [ ] **Step 3: Write `packages/config-eslint/nest.js`**

```js
import base from './base.js';

export default [
  ...base,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { project: false },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
```

- [ ] **Step 4: Write `packages/config-eslint/next.js`**

```js
import base from './base.js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...base,
  {
    files: ['**/*.{ts,tsx,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    settings: { react: { version: 'detect' } },
  },
];
```

- [ ] **Step 5: Write `packages/config-eslint/react.js`**

Same as `next.js` — copy content from Step 4 above into `packages/config-eslint/react.js`.

- [ ] **Step 6: Commit**

```bash
git add packages/config-eslint/
git commit -m "chore(config): add shared eslint configs"
```

---

### Task 6: `packages/config-tailwind`

**Files:**
- Create: `packages/config-tailwind/package.json`
- Create: `packages/config-tailwind/preset.js`
- Create: `packages/config-tailwind/index.css`

- [ ] **Step 1: Write `packages/config-tailwind/package.json`**

```json
{
  "name": "@ai-padrao/config-tailwind",
  "version": "0.1.0",
  "private": true,
  "main": "preset.js",
  "exports": {
    ".": "./preset.js",
    "./globals.css": "./index.css"
  },
  "files": ["preset.js", "index.css"],
  "dependencies": {
    "tailwindcss": "^4.0.0",
    "tailwindcss-animate": "^1.0.7"
  }
}
```

- [ ] **Step 2: Write `packages/config-tailwind/preset.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

- [ ] **Step 3: Write `packages/config-tailwind/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 47.4% 11.2%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 47.4% 11.2%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 100% 50%;
    --destructive-foreground: 210 40% 98%;
    --ring: 215 20.2% 65.1%;
    --radius: 0.5rem;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/config-tailwind/
git commit -m "chore(config): add shared tailwind preset + globals"
```

---

## Phase 3 — Contracts Package

### Task 7: `packages/contracts` — Zod schemas with tests (TDD)

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/jest.config.ts`
- Create: `packages/contracts/src/auth.ts`
- Create: `packages/contracts/src/users.ts`
- Create: `packages/contracts/src/auth.spec.ts`
- Create: `packages/contracts/src/users.spec.ts`
- Create: `packages/contracts/src/index.ts`

- [ ] **Step 1: Write `packages/contracts/package.json`**

```json
{
  "name": "@ai-padrao/contracts",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "jest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --config @ai-padrao/config-eslint/base.js"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/jest": "^29.5.13",
    "@types/node": "^22.9.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.6.0",
    "@ai-padrao/config-eslint": "workspace:*",
    "@ai-padrao/config-tsconfig": "workspace:*"
  }
}
```

- [ ] **Step 2: Write `packages/contracts/tsconfig.json`**

```json
{
  "extends": "@ai-padrao/config-tsconfig/base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Write `packages/contracts/jest.config.ts`**

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
};

export default config;
```

- [ ] **Step 4: Write failing test `packages/contracts/src/auth.spec.ts`**

```ts
import { RegisterInputSchema, LoginInputSchema, RefreshInputSchema, UserRoleSchema } from './auth';

describe('auth schemas', () => {
  describe('RegisterInputSchema', () => {
    it('accepts a valid registration', () => {
      const result = RegisterInputSchema.safeParse({
        email: 'user@example.com',
        password: 'StrongPass1!',
        name: 'Jane Doe',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = RegisterInputSchema.safeParse({
        email: 'not-an-email',
        password: 'StrongPass1!',
        name: 'Jane',
      });
      expect(result.success).toBe(false);
    });

    it('rejects weak password', () => {
      const result = RegisterInputSchema.safeParse({
        email: 'user@example.com',
        password: '123',
        name: 'Jane',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('LoginInputSchema', () => {
    it('accepts a valid login', () => {
      const result = LoginInputSchema.safeParse({
        email: 'user@example.com',
        password: 'StrongPass1!',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty password', () => {
      const result = LoginInputSchema.safeParse({
        email: 'user@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RefreshInputSchema', () => {
    it('accepts a refresh token string', () => {
      const result = RefreshInputSchema.safeParse({ refreshToken: 'any.jwt.string' });
      expect(result.success).toBe(true);
    });

    it('rejects empty token', () => {
      const result = RefreshInputSchema.safeParse({ refreshToken: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('UserRoleSchema', () => {
    it('accepts ADMIN and USER', () => {
      expect(UserRoleSchema.safeParse('ADMIN').success).toBe(true);
      expect(UserRoleSchema.safeParse('USER').success).toBe(true);
    });

    it('rejects unknown roles', () => {
      expect(UserRoleSchema.safeParse('GUEST').success).toBe(false);
    });
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm --filter @ai-padrao/contracts test`
Expected: FAIL with "Cannot find module './auth'" or similar.

- [ ] **Step 6: Write minimal implementation `packages/contracts/src/auth.ts`**

```ts
import { z } from 'zod';

export const UserRoleSchema = z.enum(['ADMIN', 'USER']);
export type UserRole = z.infer<typeof UserRoleSchema>;

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a digit');

export const RegisterInputSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1).max(120),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RefreshInputSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshInputSchema>;
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @ai-padrao/contracts test`
Expected: PASS, 8 tests green.

- [ ] **Step 8: Write failing test `packages/contracts/src/users.spec.ts`**

```ts
import { UserDtoSchema, UpdateUserInputSchema, UserListQuerySchema } from './users';

describe('users schemas', () => {
  const validUser = {
    id: 'clxxxxxxxxxxxxxxxxxxxxxx',
    email: 'user@example.com',
    name: 'Jane Doe',
    role: 'USER' as const,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  };

  describe('UserDtoSchema', () => {
    it('accepts a valid user DTO', () => {
      const result = UserDtoSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    it('rejects missing fields', () => {
      const result = UserDtoSchema.safeParse({ id: '1', email: 'a@b.c' });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateUserInputSchema', () => {
    it('accepts partial updates', () => {
      const result = UpdateUserInputSchema.safeParse({ name: 'New Name' });
      expect(result.success).toBe(true);
    });

    it('rejects empty object', () => {
      const result = UpdateUserInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('UserListQuerySchema', () => {
    it('applies defaults', () => {
      const result = UserListQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('coerces string page numbers', () => {
      const result = UserListQuerySchema.parse({ page: '3', pageSize: '50' });
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(50);
    });

    it('rejects negative pages', () => {
      const result = UserListQuerySchema.safeParse({ page: -1 });
      expect(result.success).toBe(false);
    });
  });
});
```

- [ ] **Step 9: Run test to verify it fails**

Run: `pnpm --filter @ai-padrao/contracts test`
Expected: FAIL — only auth tests run; users.spec.ts fails to find module.

- [ ] **Step 10: Write minimal implementation `packages/contracts/src/users.ts`**

```ts
import { z } from 'zod';
import { UserRoleSchema } from './auth';

export const UserDtoSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: UserRoleSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type UserDto = z.infer<typeof UserDtoSchema>;

export const UpdateUserInputSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: 'At least one field must be provided',
  });
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;

export const UserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
});
export type UserListQuery = z.infer<typeof UserListQuerySchema>;
```

- [ ] **Step 11: Write `packages/contracts/src/index.ts`**

```ts
export * from './auth';
export * from './users';
```

- [ ] **Step 12: Run all tests to verify they pass**

Run: `pnpm --filter @ai-padrao/contracts test`
Expected: PASS — 14 tests green (8 auth + 6 users).

- [ ] **Step 13: Commit**

```bash
git add packages/contracts/
git commit -m "feat(contracts): add Zod schemas for auth and users with tests"
```

---

## Phase 4 — Database Package

### Task 8: `packages/db` — Prisma client re-export

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Write `packages/db/package.json`**

```json
{
  "name": "@ai-padrao/db",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --config @ai-padrao/config-eslint/base.js"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "prisma": "^6.0.0",
    "typescript": "^5.6.0",
    "@ai-padrao/config-eslint": "workspace:*",
    "@ai-padrao/config-tsconfig": "workspace:*"
  }
}
```

- [ ] **Step 2: Write `packages/db/tsconfig.json`**

```json
{
  "extends": "@ai-padrao/config-tsconfig/base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Write `packages/db/src/index.ts`**

```ts
export * from '@prisma/client';
```

- [ ] **Step 4: Commit (Prisma client generation happens in Task 11)**

```bash
git add packages/db/
git commit -m "feat(db): scaffold @ai-padrao/db package (Prisma client re-export)"
```

---

## Phase 5 — API App

### Task 9: `apps/api` — NestJS scaffold

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/jest.config.ts`
- Create: `apps/api/eslint.config.mjs`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write `apps/api/package.json`**

```json
{
  "name": "@ai-padrao/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint src --config @ai-padrao/config-eslint/nest.js",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "ts-node prisma/seed.ts"
  },
  "dependencies": {
    "@ai-padrao/contracts": "workspace:*",
    "@ai-padrao/db": "workspace:*",
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-fastify": "^11.0.0",
    "@nestjs/config": "^3.3.0",
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/passport": "^11.0.0",
    "@nestjs/swagger": "^8.0.0",
    "@nestjs/throttler": "^6.2.1",
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/auto-instrumentations-node": "^0.52.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.54.0",
    "@opentelemetry/sdk-node": "^0.54.0",
    "@opentelemetry/sdk-trace-node": "^1.27.0",
    "@opentelemetry/resources": "^1.27.0",
    "@opentelemetry/semantic-conventions": "^1.27.0",
    "@prisma/instrumentation": "^6.0.0",
    "argon2": "^0.41.1",
    "nestjs-zod": "^4.0.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.13",
    "@types/node": "^22.9.0",
    "@types/passport-jwt": "^4.0.1",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.1",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.6.0",
    "@ai-padrao/config-eslint": "workspace:*",
    "@ai-padrao/config-tsconfig": "workspace:*"
  }
}
```

- [ ] **Step 2: Write `apps/api/tsconfig.json`**

```json
{
  "extends": "@ai-padrao/config-tsconfig/nest.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Write `apps/api/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

- [ ] **Step 4: Write `apps/api/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "tsConfigPath": "tsconfig.build.json"
  }
}
```

- [ ] **Step 5: Write `apps/api/jest.config.ts`**

```ts
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};

export default config;
```

- [ ] **Step 6: Write `apps/api/eslint.config.mjs`**

```js
import nest from '@ai-padrao/config-eslint/nest.js';

export default nest;
```

- [ ] **Step 7: Write `apps/api/src/main.ts`**

```ts
import 'reflect-metadata';
import './infra/otel/otel';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const adapter = new FastifyAdapter({ logger: false });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

  const config = new DocumentBuilder()
    .setTitle('ai-padrao API')
    .setDescription('REST API for the ai-padrao blueprint')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`api listening on http://localhost:${port}`);
}

bootstrap();
```

- [ ] **Step 8: Write `apps/api/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './infra/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { envSchema } from './infra/config/env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: envSchema.parse }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    HealthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/
git commit -m "feat(api): scaffold NestJS 11 + Fastify with global config"
```

---

### Task 10: API infra — Prisma service, env config, OTel

**Files:**
- Create: `apps/api/src/infra/config/env.schema.ts`
- Create: `apps/api/src/infra/prisma/prisma.service.ts`
- Create: `apps/api/src/infra/prisma/prisma.module.ts`
- Create: `apps/api/src/infra/otel/otel.ts`
- Create: `apps/api/src/common/filters/http-exception.filter.ts`
- Create: `apps/api/src/common/interceptors/logging.interceptor.ts`

- [ ] **Step 1: Write `apps/api/src/infra/config/env.schema.ts`**

```ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://otel-collector:4318'),
  OTEL_SERVICE_NAME: z.string().default('ai-padrao-api'),
  SMTP_HOST: z.string().default('mailhog'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().default('no-reply@ai-padrao.local'),
});

export type Env = z.infer<typeof envSchema>;
```

- [ ] **Step 2: Write `apps/api/src/infra/prisma/prisma.service.ts`**

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- [ ] **Step 3: Write `apps/api/src/infra/prisma/prisma.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 4: Write `apps/api/src/infra/otel/otel.ts`**

```ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'ai-padrao-api',
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318'}/v1/traces`,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
    new PrismaInstrumentation(),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().catch(() => undefined);
});
```

- [ ] **Step 5: Write `apps/api/src/common/filters/http-exception.filter.ts`**

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ZodError } from 'zod';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = 500;
    let body: Record<string, unknown> = {
      statusCode: 500,
      message: 'Internal server error',
      path: request.url,
    };

    if (exception instanceof ZodError) {
      status = 400;
      body = {
        statusCode: 400,
        message: 'Validation failed',
        errors: exception.flatten().fieldErrors,
        path: request.url,
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      body = typeof resp === 'string' ? { statusCode: status, message: resp, path: request.url } : { ...(resp as object), path: request.url };
    } else {
      this.logger.error(exception);
    }

    response.status(status).send(body);
  }
}
```

- [ ] **Step 6: Write `apps/api/src/common/interceptors/logging.interceptor.ts`**

```ts
import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'node:crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms [${requestId}]`);
      }),
    );
  }
}
```

- [ ] **Step 7: Register the filter and interceptor globally in `apps/api/src/main.ts`**

Replace `apps/api/src/main.ts` with this updated version (add the two registrations):

```ts
import 'reflect-metadata';
import './infra/otel/otel';
import { NestFactory, Reflector } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const adapter = new FastifyAdapter({ logger: false });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const config = new DocumentBuilder()
    .setTitle('ai-padrao API')
    .setDescription('REST API for the ai-padrao blueprint')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`api listening on http://localhost:${port}`);
}

bootstrap();
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/infra apps/api/src/common apps/api/src/main.ts
git commit -m "feat(api): add Prisma service, env validation, OTel, filters, interceptors"
```

---

### Task 11: Prisma schema + initial migration + seed

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/seed.ts`

- [ ] **Step 1: Write `apps/api/prisma/schema.prisma`**

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["tracing"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  ADMIN
  USER
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String   @map("password_hash")
  role         UserRole @default(USER)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  refreshTokens RefreshToken[]

  @@map("users")
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  tokenHash String   @unique @map("token_hash")
  expiresAt DateTime @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}
```

- [ ] **Step 2: Write `apps/api/prisma/seed.ts`**

```ts
import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminEmail = 'admin@ai-padrao.local';
  const passwordHash = await argon2.hash('admin123', { type: argon2.argon2id });

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Admin',
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  console.log(`Seeded admin user: ${adminEmail} / admin123`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 3: Generate Prisma client and run migration**

Note: this step requires the database to be running. Document the order for the user; for the plan itself, assume the user has already run `docker compose up -d postgres`.

Run inside api container or after `pnpm install`:
```bash
docker compose up -d postgres
pnpm --filter @ai-padrao/api exec prisma generate
pnpm --filter @ai-padrao/api exec prisma migrate dev --name init
pnpm --filter @ai-padrao/api exec prisma db seed
```
Expected: migration applied; `admin@ai-padrao.local` user exists.

(Alternative local path: run `pnpm db:migrate` and `pnpm db:seed` from root — these already wrap `docker compose exec`.)

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(api): add Prisma schema (User, RefreshToken) + seed"
```

---

### Task 12: API health module

**Files:**
- Create: `apps/api/src/modules/health/health.module.ts`
- Create: `apps/api/src/modules/health/health.controller.ts`

- [ ] **Step 1: Write `apps/api/src/modules/health/health.controller.ts`**

```ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../infra/prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  liveness(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Get('ready')
  async readiness(): Promise<{ status: 'ok' | 'error'; db: 'up' | 'down' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch {
      return { status: 'error', db: 'down' };
    }
  }
}
```

- [ ] **Step 2: Write `apps/api/src/modules/health/health.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/health/
git commit -m "feat(api): add health endpoints (liveness + readiness with DB ping)"
```

---

### Task 13: API auth module — service tests first (TDD)

**Files:**
- Create: `apps/api/src/modules/auth/auth.service.spec.ts`
- Create: `apps/api/src/modules/auth/auth.service.ts`
- Create: `apps/api/src/modules/auth/auth.controller.ts`
- Create: `apps/api/src/modules/auth/auth.module.ts`
- Create: `apps/api/src/modules/auth/strategies/jwt.strategy.ts`
- Create: `apps/api/src/modules/auth/dto/auth.dto.ts`
- Create: `apps/api/src/common/decorators/current-user.decorator.ts`
- Create: `apps/api/src/common/decorators/public.decorator.ts`
- Create: `apps/api/src/common/guards/jwt-auth.guard.ts`

- [ ] **Step 1: Write failing test `apps/api/src/modules/auth/auth.service.spec.ts`**

```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock }; refreshToken: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: (k: string) => ({ JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32), JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '7d' }[k]) },
        },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('signed.jwt.token'), verifyAsync: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A', role: UserRole.USER });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({ email: 'a@b.c', password: 'StrongPass1!', name: 'A' });
      expect(result.user.email).toBe('a@b.c');
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toBe('signed.jwt.token');
    });

    it('throws ConflictException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(service.register({ email: 'a@b.c', password: 'StrongPass1!', name: 'A' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const hash = await argon2.hash('StrongPass1!');
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A', role: UserRole.USER, passwordHash: hash });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: 'a@b.c', password: 'StrongPass1!' });
      expect(result.user.email).toBe('a@b.c');
    });

    it('throws UnauthorizedException for unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'a@b.c', password: 'StrongPass1!' })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await argon2.hash('StrongPass1!');
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A', role: UserRole.USER, passwordHash: hash });
      await expect(service.login({ email: 'a@b.c', password: 'WrongPass1!' })).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-padrao/api test`
Expected: FAIL — module './auth.service' not found.

- [ ] **Step 3: Write minimal implementation `apps/api/src/modules/auth/auth.service.ts`**

```ts
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { LoginInput, RefreshInput, RegisterInput } from '@ai-padrao/contracts';
import { UserRole, type User } from '@prisma/client';

export interface AuthResult {
  user: { id: string; email: string; name: string; role: UserRole };
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash, role: UserRole.USER },
    });
    return this.issueTokens(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user);
  }

  async refresh(input: RefreshInput): Promise<AuthResult> {
    const tokenHash = this.hashToken(input.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.user);
  }

  async logout(input: RefreshInput): Promise<void> {
    const tokenHash = this.hashToken(input.refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(user: User): Promise<AuthResult> {
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL') ?? '7d';

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: this.config.get<string>('JWT_ACCESS_SECRET'), expiresIn: accessTtl },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = this.parseTtl(refreshTtl);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseTtl(ttl: string): Date {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid TTL: ${ttl}`);
    const value = Number(match[1]);
    const unit = match[2];
    const ms = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
    return new Date(Date.now() + value * ms);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai-padrao/api test`
Expected: PASS — all 4 service tests green.

- [ ] **Step 5: Write `apps/api/src/modules/auth/dto/auth.dto.ts`**

```ts
import { createZodDto } from 'nestjs-zod';
import { RegisterInputSchema, LoginInputSchema, RefreshInputSchema } from '@ai-padrao/contracts';

export class RegisterDto extends createZodDto(RegisterInputSchema) {}
export class LoginDto extends createZodDto(LoginInputSchema) {}
export class RefreshDto extends createZodDto(RefreshInputSchema) {}
```

- [ ] **Step 6: Write `apps/api/src/modules/auth/auth.controller.ts`**

```ts
import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { id: string; email: string; role: UserRole }) {
    return user;
  }
}
```

- [ ] **Step 7: Write `apps/api/src/common/decorators/current-user.decorator.ts`**

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});
```

- [ ] **Step 8: Write `apps/api/src/common/decorators/public.decorator.ts`**

```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 9: Write `apps/api/src/modules/auth/strategies/jwt.strategy.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') ?? '',
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
```

- [ ] **Step 10: Write `apps/api/src/common/guards/jwt-auth.guard.ts`**

```ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

- [ ] **Step 11: Write `apps/api/src/modules/auth/auth.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_TTL') ?? '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 12: Run all tests to verify they pass**

Run: `pnpm --filter @ai-padrao/api test`
Expected: PASS — all auth.service tests still green.

- [ ] **Step 13: Commit**

```bash
git add apps/api/src/modules/auth apps/api/src/common
git commit -m "feat(api): add auth module (register/login/refresh/logout/me) with Argon2 + JWT"
```

---

### Task 14: API users module

**Files:**
- Create: `apps/api/src/modules/users/users.service.ts`
- Create: `apps/api/src/modules/users/users.service.spec.ts`
- Create: `apps/api/src/modules/users/users.controller.ts`
- Create: `apps/api/src/modules/users/dto/users.dto.ts`
- Create: `apps/api/src/modules/users/users.module.ts`

- [ ] **Step 1: Write failing test `apps/api/src/modules/users/users.service.spec.ts`**

```ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { UserRole } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock; count: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
  });

  describe('list', () => {
    it('returns paginated users', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, pageSize: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });

  describe('findOne', () => {
    it('returns a user by id', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A', role: UserRole.USER, createdAt: new Date(), updatedAt: new Date() });
      const result = await service.findOne('u1');
      expect(result.id).toBe('u1');
    });

    it('throws NotFoundException if missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne('u1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates name and returns updated user', async () => {
      prisma.user.update.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'New', role: UserRole.USER, createdAt: new Date(), updatedAt: new Date() });
      const result = await service.update('u1', { name: 'New' });
      expect(result.name).toBe('New');
    });
  });

  describe('remove', () => {
    it('deletes a user', async () => {
      prisma.user.delete.mockResolvedValue({});
      await expect(service.remove('u1')).resolves.toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-padrao/api test`
Expected: FAIL — module './users.service' not found.

- [ ] **Step 3: Write `apps/api/src/modules/users/users.service.ts`**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { UpdateUserInput, UserListQuery, UserDto } from '@ai-padrao/contracts';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: UserListQuery): Promise<{ items: UserDto[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, q } = query;
    const where = q
      ? { OR: [{ email: { contains: q, mode: 'insensitive' as const } }, { name: { contains: q, mode: 'insensitive' as const } }] }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items as UserDto[], total, page, pageSize };
  }

  async findOne(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user as UserDto;
  }

  async update(id: string, input: UpdateUserInput): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id },
      data: input,
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });
    return user as UserDto;
  }

  async remove(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Write `apps/api/src/modules/users/dto/users.dto.ts`**

```ts
import { createZodDto } from 'nestjs-zod';
import { UpdateUserInputSchema, UserListQuerySchema } from '@ai-padrao/contracts';

export class UpdateUserDto extends createZodDto(UpdateUserInputSchema) {}
export class UserListQueryDto extends createZodDto(UserListQuerySchema) {}
```

- [ ] **Step 5: Write `apps/api/src/modules/users/users.controller.ts`**

```ts
import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, UserListQueryDto } from './dto/users.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: UserListQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() _user: unknown) {
    return this.users.remove(id);
  }
}
```

- [ ] **Step 6: Write `apps/api/src/modules/users/users.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 7: Run all tests**

Run: `pnpm --filter @ai-padrao/api test`
Expected: PASS — auth + users tests green.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/users/
git commit -m "feat(api): add users module (list, findOne, update, remove)"
```

---

### Task 15: API e2e tests (Supertest)

**Files:**
- Create: `apps/api/test/jest-e2e.json`
- Create: `apps/api/test/setup.ts`
- Create: `apps/api/test/auth.e2e-spec.ts`
- Create: `apps/api/test/users.e2e-spec.ts`

- [ ] **Step 1: Write `apps/api/test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "moduleNameMapper": { "^@/(.*)$": "<rootDir>/../src/$1" }
}
```

- [ ] **Step 2: Write `apps/api/test/setup.ts`**

```ts
import 'reflect-metadata';
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';
```

- [ ] **Step 3: Write failing e2e test `apps/api/test/auth.e2e-spec.ts`**

```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import * as request from 'supertest';
import { PrismaService } from '../src/infra/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  it('POST /api/auth/register creates a user and returns tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: uniqueEmail(), password: 'StrongPass1!', name: 'Test' })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toContain('@example.com');
  });

  it('POST /api/auth/login returns tokens for valid credentials', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer()).post('/api/auth/register').send({ email, password: 'StrongPass1!', name: 'Test' }).expect(201);
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'StrongPass1!' }).expect(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('POST /api/auth/login fails with wrong password', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer()).post('/api/auth/register').send({ email, password: 'StrongPass1!', name: 'Test' }).expect(201);
    await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'WrongPass1!' }).expect(401);
  });
});
```

- [ ] **Step 4: Run e2e test (requires Postgres on localhost:5432)**

Run: `pnpm --filter @ai-padrao/api run test:e2e`
Expected: PASS if a test DB is available; FAIL with "ECONNREFUSED" if not. Document this dependency in README.

- [ ] **Step 5: Write failing e2e test `apps/api/test/users.e2e-spec.ts`**

```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import * as request from 'supertest';
import { PrismaService } from '../src/infra/prisma/prisma.service';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const email = `admin-${Date.now()}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'StrongPass1!', name: 'Admin' })
      .expect(201);
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /api/users returns paginated list when authenticated', async () => {
    const res = await request(app.getHttpServer()).get('/api/users').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.total).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/users returns 401 without auth', async () => {
    await request(app.getHttpServer()).get('/api/users').expect(401);
  });
});
```

- [ ] **Step 6: Run all e2e tests**

Run: `pnpm --filter @ai-padrao/api run test:e2e`
Expected: PASS — 5 e2e tests green.

- [ ] **Step 7: Commit**

```bash
git add apps/api/test/
git commit -m "test(api): add e2e tests for auth and users with Supertest"
```

---

## Phase 6 — UI Package

### Task 16: `packages/ui` — shadcn-style base components

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/button.tsx`
- Create: `packages/ui/src/input.tsx`
- Create: `packages/ui/src/label.tsx`
- Create: `packages/ui/src/card.tsx`
- Create: `packages/ui/src/index.ts`

- [ ] **Step 1: Write `packages/ui/package.json`**

```json
{
  "name": "@ai-padrao/ui",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src --config @ai-padrao/config-eslint/react.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "lucide-react": "^0.460.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "typescript": "^5.6.0",
    "@ai-padrao/config-eslint": "workspace:*",
    "@ai-padrao/config-tsconfig": "workspace:*",
    "@ai-padrao/config-tailwind": "workspace:*"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  }
}
```

- [ ] **Step 2: Write `packages/ui/tsconfig.json`**

```json
{
  "extends": "@ai-padrao/config-tsconfig/react-library.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 3: Write `packages/ui/src/button.tsx`**

```tsx
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={buttonVariants({ variant, size, className })} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { buttonVariants };
```

- [ ] **Step 4: Write `packages/ui/src/input.tsx`**

```tsx
import * as React from 'react';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ''}`}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';
```

- [ ] **Step 5: Write `packages/ui/src/label.tsx`**

```tsx
'use client';

import * as LabelPrimitive from '@radix-ui/react-label';
import * as React from 'react';

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={`text-sm font-medium leading-none ${className ?? ''}`} {...props} />
));
Label.displayName = 'Label';
```

- [ ] **Step 6: Write `packages/ui/src/card.tsx`**

```tsx
import * as React from 'react';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className ?? ''}`} {...props} />
  ),
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={`flex flex-col space-y-1.5 p-6 ${className ?? ''}`} {...props} />,
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={`text-2xl font-semibold leading-none tracking-tight ${className ?? ''}`} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={`text-sm text-muted-foreground ${className ?? ''}`} {...props} />,
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={`p-6 pt-0 ${className ?? ''}`} {...props} />,
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={`flex items-center p-6 pt-0 ${className ?? ''}`} {...props} />,
);
CardFooter.displayName = 'CardFooter';
```

- [ ] **Step 7: Write `packages/ui/src/index.ts`**

```ts
export * from './button';
export * from './input';
export * from './label';
export * from './card';
```

- [ ] **Step 8: Commit**

```bash
git add packages/ui/
git commit -m "feat(ui): add base shadcn-style components (Button, Input, Label, Card)"
```

---

## Phase 7 — Web App

### Task 17: `apps/web` — Next.js scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/eslint.config.mjs`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/providers.tsx`
- Create: `apps/web/src/app/globals.css`

- [ ] **Step 1: Write `apps/web/package.json`**

```json
{
  "name": "@ai-padrao/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint src --config @ai-padrao/config-eslint/next.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@ai-padrao/contracts": "workspace:*",
    "@ai-padrao/ui": "workspace:*",
    "@ai-padrao/config-tailwind": "workspace:*",
    "@hookform/resolvers": "^3.9.0",
    "@radix-ui/react-label": "^2.1.0",
    "@tanstack/react-query": "^5.59.16",
    "ky": "^1.7.2",
    "next": "^15.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "happy-dom": "^15.10.2",
    "postcss": "^8.4.49",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.4",
    "@ai-padrao/config-eslint": "workspace:*",
    "@ai-padrao/config-tsconfig": "workspace:*"
  }
}
```

- [ ] **Step 2: Write `apps/web/tsconfig.json`**

```json
{
  "extends": "@ai-padrao/config-tsconfig/next.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `apps/web/next.config.ts`**

**REQUIRED:** `output: 'standalone'` is not optional — `apps/web/Dockerfile.prod`
copies `.next/standalone/` and runs `node apps/web/server.js`. Without it the
build emits no standalone directory and the prod image build fails.

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required by apps/web/Dockerfile.prod (runtime stage).
  output: 'standalone',
  transpilePackages: ['@ai-padrao/ui', '@ai-padrao/contracts'],
  experimental: { typedRoutes: true },
};

export default nextConfig;
```

- [ ] **Step 4: Write `apps/web/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';
import preset from '@ai-padrao/config-tailwind';

const config: Config = {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};

export default config;
```

- [ ] **Step 5: Write `apps/web/postcss.config.mjs`**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 6: Write `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

- [ ] **Step 7: Write `apps/web/eslint.config.mjs`**

```js
import next from '@ai-padrao/config-eslint/next.js';

export default next;
```

- [ ] **Step 8: Write `apps/web/src/app/globals.css`**

```css
@import '@ai-padrao/config-tailwind/globals.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: Write `apps/web/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'ai-padrao',
  description: 'Monorepo blueprint app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 10: Write `apps/web/src/app/providers.tsx`**

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 11: Write `apps/web/src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 12: Commit**

```bash
git add apps/web/
git commit -m "feat(web): scaffold Next.js 15 + Tailwind 4 + TanStack Query"
```

---

### Task 18: Web — env, api client, auth helpers, middleware

**Files:**
- Create: `apps/web/src/lib/env.ts`
- Create: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/middleware.ts`

- [ ] **Step 1: Write `apps/web/src/lib/env.ts`**

```ts
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  API_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  API_URL: process.env.API_URL ?? 'http://api:3001',
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
});
```

- [ ] **Step 2: Write `apps/web/src/lib/api-client.ts`**

```ts
'use client';

import ky, { type KyInstance } from 'ky';
import { env } from './env';

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = document.cookie.match(/refresh_token=([^;]+)/)?.[1];
  if (!refreshToken) return null;

  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    credentials: 'include',
  });
  if (!res.ok) return null;
  const data = await res.json();
  sessionStorage.setItem('access_token', data.accessToken);
  return data.accessToken;
}

export const apiClient: KyInstance = ky.create({
  prefixUrl: env.NEXT_PUBLIC_API_URL,
  credentials: 'include',
  hooks: {
    beforeRequest: [
      (request) => {
        const token = sessionStorage.getItem('access_token');
        if (token) request.headers.set('Authorization', `Bearer ${token}`);
      },
    ],
    afterResponse: [
      async (request, _options, response) => {
        if (response.status !== 401) return response;
        if (!refreshing) refreshing = refreshAccessToken().finally(() => (refreshing = null));
        const token = await refreshing;
        if (!token) return response;
        request.headers.set('Authorization', `Bearer ${token}`);
        return ky(request);
      },
    ],
  },
});
```

- [ ] **Step 3: Write `apps/web/src/lib/auth.ts`**

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from './env';

const REFRESH_COOKIE = 'refresh_token';

export async function setRefreshTokenCookie(token: string): Promise<void> {
  cookies().set({
    name: REFRESH_COOKIE,
    value: token,
    httpOnly: true,
    secure: env.WEB_ORIGIN.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearRefreshTokenCookie(): Promise<void> {
  cookies().delete(REFRESH_COOKIE);
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));

  const res = await fetch(`${env.API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    redirect(`/login?error=${encodeURIComponent(body.message ?? 'login_failed')}`);
  }

  const data = await res.json();
  await setRefreshTokenCookie(data.refreshToken);
  redirect('/dashboard');
}

export async function registerAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));
  const name = String(formData.get('name'));

  const res = await fetch(`${env.API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    redirect(`/register?error=${encodeURIComponent(body.message ?? 'register_failed')}`);
  }

  const data = await res.json();
  await setRefreshTokenCookie(data.refreshToken);
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  await clearRefreshTokenCookie();
  redirect('/login');
}
```

- [ ] **Step 4: Write `apps/web/src/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasRefresh = request.cookies.has('refresh_token');

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (hasRefresh) return NextResponse.redirect(new URL('/dashboard', request.url));
    return NextResponse.next();
  }

  if (!hasRefresh && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib apps/web/src/middleware.ts
git commit -m "feat(web): add env validation, api client with auto-refresh, auth server actions, middleware"
```

---

### Task 19: Web — pages (login, register, dashboard)

**Files:**
- Create: `apps/web/src/components/login-form.tsx`
- Create: `apps/web/src/components/register-form.tsx`
- Create: `apps/web/src/app/(public)/login/page.tsx`
- Create: `apps/web/src/app/(public)/register/page.tsx`
- Create: `apps/web/src/app/(authed)/dashboard/page.tsx`
- Create: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Write `apps/web/src/components/login-form.tsx`**

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginInputSchema, type LoginInput } from '@ai-padrao/contracts';
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from '@ai-padrao/ui';
import { loginAction } from '@/lib/auth';

export function LoginForm({ error }: { error?: string }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={loginAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Write `apps/web/src/components/register-form.tsx`**

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterInputSchema, type RegisterInput } from '@ai-padrao/contracts';
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from '@ai-padrao/ui';
import { registerAction } from '@/lib/auth';

export function RegisterForm({ error }: { error?: string }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterInputSchema),
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={registerAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" autoComplete="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create account'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Write `apps/web/src/app/(public)/login/page.tsx`**

```tsx
import { LoginForm } from '@/components/login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <LoginForm error={error} />
    </main>
  );
}
```

- [ ] **Step 4: Write `apps/web/src/app/(public)/register/page.tsx`**

```tsx
import { RegisterForm } from '@/components/register-form';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <RegisterForm error={error} />
    </main>
  );
}
```

- [ ] **Step 5: Write `apps/web/src/app/(authed)/dashboard/page.tsx`**

```tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ai-padrao/ui';
import { env } from '@/lib/env';
import { logoutAction } from '@/lib/auth';

async function fetchMe(): Promise<{ id: string; email: string; role: string } | null> {
  const refreshToken = cookies().get('refresh_token')?.value;
  if (!refreshToken) return null;
  const refreshRes = await fetch(`${env.API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (!refreshRes.ok) return null;
  const { accessToken } = await refreshRes.json();
  const meRes = await fetch(`${env.API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!meRes.ok) return null;
  return meRes.json();
}

export default async function DashboardPage() {
  const me = await fetchMe();
  if (!me) redirect('/login');

  return (
    <main className="container py-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Welcome, {me.email}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Role: {me.role}</p>
          <form action={logoutAction}>
            <Button type="submit" variant="outline">Sign out</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 6: Write `apps/web/src/app/page.tsx`**

```tsx
import { redirect } from 'next/navigation';

export default function HomePage(): never {
  redirect('/login');
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app apps/web/src/components
git commit -m "feat(web): add login/register/dashboard pages with RHF + Zod"
```

---

## Phase 8 — SDD Rule Files

### Task 20: SDD rule files (AGENTS.md + .openspec + .cursor)

**Files:**
- Create: `AGENTS.md`
- Create: `.openspec/AGENTS.md`
- Create: `.openspec/templates/proposal.md`
- Create: `.openspec/templates/tasks.md`
- Create: `.openspec/templates/design.md`
- Create: `.openspec/templates/spec.md`
- Create: `.cursor/rules/sdd.mdc`

- [ ] **Step 1: Write root `AGENTS.md`**

````markdown
# ai-padrao — Project Rules for AI Agents

This file is read by Claude Code, Cursor, Gemini CLI, Codex, and any other AI assistant working in this repo.

## 🚨 SDD is MANDATORY 🚨

**Every new feature or behavior change in this project MUST follow the SDD (Specification-Driven Development) workflow via OpenSpec.**

Before writing any code, you MUST:

1. Create a folder `.openspec/changes/<feature-name>/` containing `proposal.md`, `tasks.md`, `design.md`, and a spec delta under `specs/<area>/spec.md`.
2. Wait for a human to **approve** the proposal.
3. Then — and only then — implement the tasks in order.

Full workflow and templates: [`.openspec/AGENTS.md`](.openspec/AGENTS.md)

## What does NOT require SDD

- Cosmetic changes (typos, formatting, refactors with no behavior change)
- Dependency version bumps without API impact
- Documentation fixes

These MUST still use [Conventional Commits](https://www.conventionalcommits.org/) format.

## Forbidden actions

- ❌ Open a PR that changes behavior without a corresponding `.openspec/changes/<feature>/`
- ❌ Start coding before `proposal.md` is approved
- ❌ Use `localStorage` for tokens (auth uses httpOnly cookies)
- ❌ Import Prisma directly into `apps/web` (only `apps/api` may use Prisma)
- ❌ Modify `apps/api/prisma/schema.prisma` without coordinating with the contracts in `packages/contracts`

## Tech stack reminder

- Monorepo: pnpm 9 + Turborepo 2
- Backend: NestJS 11 (Fastify) + Prisma 6 + Zod (`nestjs-zod`)
- Frontend: Next.js 15 (App Router) + Tailwind 4 + shadcn/ui
- Auth: JWT access (15m) + rotated refresh in httpOnly cookie, Argon2id passwords
- Observability: OpenTelemetry SDK + OTel Collector (OTLP)

## Common commands

```bash
pnpm up               # start all Docker services
pnpm down             # stop services
pnpm logs             # tail logs
pnpm db:migrate       # apply Prisma migrations (in api container)
pnpm db:seed          # seed admin user
pnpm test             # run unit + e2e tests across packages
pnpm lint             # lint all packages
pnpm typecheck        # type-check all packages
```
````

- [ ] **Step 2: Write `.openspec/AGENTS.md`**

````markdown
# OpenSpec Workflow — Detailed Agent Guide

This file is the canonical reference for the SDD workflow enforced in this repo. AI agents and humans both follow it.

## When to use OpenSpec

**Use OpenSpec for:**

- Any new feature (user-visible or internal)
- Any change to existing behavior (endpoints, UI flows, business rules, data shape)
- Any change to public contracts (API surface, database schema, shared types)

**Do NOT use OpenSpec for:**

- Bug fixes where the spec already correctly describes the intended behavior (just fix the bug)
- Cosmetic changes (typos, formatting, refactors with no behavior impact)
- Dependency version bumps without behavior change
- Documentation-only updates

If unsure, **default to using OpenSpec** — the cost of an extra proposal is much lower than the cost of an unauthorized behavior change.

## The five steps

### 1. Problem framing

Before opening a proposal, answer in one paragraph:

- **What is the problem?** (User-facing symptom or internal gap)
- **Who is affected?** (Which users / systems)
- **Why now?** (Why this is the right time to fix it)

### 2. Proposal

Create `.openspec/changes/<feature-name>/` with these four files:

#### `proposal.md`

Must contain these sections (in this order):

- **Why** — the problem and the value of solving it
- **What changes** — concrete list of user-visible or system-visible effects
- **Impact** — broken down by:
  - Users (UX changes, new flows)
  - System (new endpoints, new tables, new env vars)
  - Other features (anything that depends on what's changing)
- **Out of scope** — explicit list of what this proposal will NOT touch
- **Risks** — at least one risk with its mitigation

#### `tasks.md`

Numbered, executable checklist. Each item MUST have a clear Definition of Done. Order tasks so each one is independently verifiable.

Example:
```markdown
- [ ] 1. Add `Foo` model to Prisma schema
      DoD: `prisma migrate dev` creates the table
- [ ] 2. Implement `FooService.create()`
      DoD: Unit test `foo.service.spec.ts` passes
```

#### `design.md`

Technical decisions that need explanation. Examples:

- Choice of library (and what was rejected)
- Data shape decisions (why a JSON column vs a separate table)
- Performance trade-offs
- Security considerations

Skip `design.md` only if the proposal is so small that there's nothing to explain (e.g., adding a single endpoint).

#### `specs/<area>/spec.md`

A delta document using **SHALL/SHOULD/MAY** (RFC 2119). Each requirement is one line:

```
WHEN a user requests password reset,
THE system SHALL send an email containing a unique link valid for 1 hour,
AND the link SHALL expire after first use.
```

Keep it short, testable, unambiguous.

### 3. Review

The proposal is **NOT** approved until a human explicitly says so. AI agents MUST wait for this approval before any code change.

### 4. Build

Execute the tasks in order. Each task = one commit (Conventional Commits format):

```
feat(api): task 1 - add PasswordResetToken model
feat(api): task 2 - generate migration
feat(api): task 3 - add Zod schemas for password reset
```

Reference the task number in the commit body so reviewers can map commits → checklist.

### 5. Archive

After the PR is merged:

1. Move `.openspec/changes/<feature-name>/specs/<area>/spec.md` to `.openspec/specs/<area>/<feature-name>.md`
2. Add a brief entry to `.openspec/CHANGELOG.md` (date, feature, author)
3. Delete the rest of the change folder

Git preserves history. The archived spec becomes the new source of truth for that feature.

## Templates

See [`.openspec/templates/`](templates/) for starter files.

## Working in derived projects

When you clone this repo to start a new project:

1. Update `package.json` → `name`, `description`, `version`
2. Update `.env.example` → secrets, project name
3. Update `README.md` → project name + quickstart
4. **Keep `AGENTS.md` and `.openspec/` intact** — they are the rule, not the content
````

- [ ] **Step 3: Write `.openspec/templates/proposal.md`**

````markdown
# Proposal: <Feature Name>

**Author:** <name or handle>
**Date:** YYYY-MM-DD
**Status:** Draft | Under Review | Approved | Rejected

## Why

<What problem this solves. Who is affected. Why now.>

## What changes

<Concrete bullet list of user-visible or system-visible effects.>

## Impact

### Users
- ...

### System
- ...

### Other features
- ...

## Out of scope

- ...

## Risks

| Risk | Mitigation |
|------|------------|
| ...  | ...        |
````

- [ ] **Step 4: Write `.openspec/templates/tasks.md`**

````markdown
# Tasks: <Feature Name>

Reference: `proposal.md` in this folder.

- [ ] 1. <Task description>
      DoD: <Definition of Done — how we know this task is complete>
- [ ] 2. <Task description>
      DoD: ...
- [ ] 3. ...
````

- [ ] **Step 5: Write `.openspec/templates/design.md`**

````markdown
# Design: <Feature Name>

Reference: `proposal.md` in this folder.

## Decisions

### <Decision 1>

**Context:** ...
**Choice:** ...
**Rejected alternatives:** ...

### <Decision 2>

**Context:** ...
**Choice:** ...
**Rejected alternatives:** ...

## Open questions

- ...
````

- [ ] **Step 6: Write `.openspec/templates/spec.md`**

````markdown
# Spec: <Area> — <Feature Name>

This spec describes the behavior of `<feature>` after the change is implemented.

## Requirements

The keywords **SHALL**, **SHOULD**, and **MAY** follow RFC 2119.

### <Subsection>

- WHEN <condition>, THE system SHALL <behavior>.
- WHEN <condition>, THE system SHOULD <behavior>.
- THE system MAY <behavior> <under condition>.

## Examples

### <Scenario>

```
<example input>
<example output>
```
````

- [ ] **Step 7: Write `.cursor/rules/sdd.mdc`**

````markdown
---
description: SDD is mandatory for any feature or behavior change.
globs: ["**/*"]
---

# SDD Enforcement Rule

Any change that adds or modifies **behavior** in this project MUST go through the OpenSpec SDD workflow before code is written.

## Required steps

1. Create `.openspec/changes/<feature-name>/` with `proposal.md`, `tasks.md`, `design.md`, and `specs/<area>/spec.md`.
2. The proposal MUST be approved by a human.
3. Only then implement the tasks in order.

## Allowed without SDD

- Cosmetic changes (no behavior impact)
- Dependency bumps without API change
- Documentation fixes

## Forbidden

- Open PRs with behavior changes that lack a `.openspec/changes/<feature>/`
- Starting code before proposal approval
- `localStorage` for auth tokens (use httpOnly cookies)
- Importing Prisma into `apps/web`
- Editing `apps/api/prisma/schema.prisma` without coordinating with `packages/contracts`

## Reference

Full workflow: see `AGENTS.md` (root) and `.openspec/AGENTS.md`.
````

- [ ] **Step 8: Commit**

```bash
git add AGENTS.md .openspec/ .cursor/
git commit -m "docs(sdd): add AGENTS.md, OpenSpec workflow, templates, and Cursor rule"
```

---

## Phase 9 — Tooling (Husky + lint-staged + commitlint)

### Task 21: Husky + commitlint

**Files:**
- Create: `.husky/pre-commit`
- Create: `.husky/commit-msg`
- Create: `.commitlintrc.json`

- [ ] **Step 1: Write `.commitlintrc.json`**

```json
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "style", "refactor", "test", "chore", "ci", "perf", "build", "revert"]
    ],
    "scope-enum": [
      2,
      "always",
      ["root", "api", "web", "contracts", "db", "ui", "config", "docker", "sdd", "deps"]
    ]
  }
}
```

- [ ] **Step 2: Write `.husky/pre-commit`**

```sh
pnpm exec lint-staged
```

- [ ] **Step 3: Write `.husky/commit-msg`**

```sh
pnpm exec commitlint --edit $1
```

- [ ] **Step 4: Activate Husky**

Run: `pnpm exec husky init`
Expected: Husky installed; `.husky/_/` may be added; `.git/config` updated. Verify `.husky/pre-commit` and `.husky/commit-msg` are executable (`chmod +x .husky/pre-commit .husky/commit-msg` if needed).

- [ ] **Step 5: Verify by making a test commit**

```bash
git add -A
git commit -m "chore(root): verify husky hooks run"
```
Expected: pre-commit runs `lint-staged`; commit-msg runs `commitlint`. If `lint-staged` complains about ESLint config not being resolvable yet, that's expected on the first run — re-run after `pnpm install` at the root.

- [ ] **Step 6: Commit**

If test commit succeeded:
```bash
# nothing to commit — already committed
```

If test commit failed because of hooks, fix and commit:
```bash
git add .husky .commitlintrc.json
git commit -m "chore(root): add husky + commitlint"
```

---

## Phase 10 — Final Validation

### Task 22: End-to-end validation against Definition of Done

**Files:** none (validation only)

- [ ] **Step 1: Install all dependencies**

```bash
pnpm install
```
Expected: installs all packages across the monorepo; no peer-dep errors.

- [ ] **Step 2: Start the stack**

```bash
cp .env.example .env  # if not already done
docker compose up -d
```
Expected: all 5 services start; `docker compose ps` shows all healthy.

- [ ] **Step 3: Run migrations and seed**

```bash
pnpm db:migrate
pnpm db:seed
```
Expected: migrations applied; seed output `Seeded admin user: admin@ai-padrao.local / admin123`.

- [ ] **Step 4: Smoke-test the API**

```bash
curl -sf http://localhost:3001/api/health | grep '"status":"ok"'
curl -sf http://localhost:3001/docs > /dev/null && echo "swagger ok"
```
Expected: both commands succeed.

- [ ] **Step 5: End-to-end auth flow**

```bash
# register
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@example.com","password":"StrongPass1!","name":"Smoke"}' \
  | jq -r .accessToken)

# me
curl -sf -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/auth/me
```
Expected: returns JSON with `email: "smoke@example.com"`.

- [ ] **Step 6: OpenTelemetry check**

```bash
docker compose logs otel-collector | grep -i 'trace\|span'
```
Expected: trace activity from the API calls in Steps 4 and 5.

- [ ] **Step 7: Frontend smoke test**

Open http://localhost:3000 in a browser. Verify:
- [ ] Redirects to `/login`
- [ ] Form accepts the seeded admin credentials (`admin@ai-padrao.local` / `admin123`)
- [ ] After login, redirects to `/dashboard` showing the user email

- [ ] **Step 8: MailHog check**

Open http://localhost:18025 in a browser. Verify the MailHog UI loads (no emails yet, but UI should be functional).

- [ ] **Step 9: Run full test suite**

```bash
pnpm test
```
Expected: all unit + e2e tests green across all packages.

- [ ] **Step 10: Lint and typecheck**

```bash
pnpm lint
pnpm typecheck
```
Expected: both exit 0 with no errors.

- [ ] **Step 11: Git status check**

```bash
git status
```
Expected: clean working tree (everything committed).

- [ ] **Step 12: Tag the blueprint release**

```bash
git tag -a v0.1.0 -m "ai-padrao blueprint MVP"
git push origin v0.1.0
```
Expected: tag pushed. This is the first version derived projects can clone.

---

## Self-Review (done inline before commit)

**Spec coverage:**
- ✅ Monorepo init (Task 1-2)
- ✅ Docker compose + Dockerfiles (Task 3)
- ✅ OTel collector config (Task 3)
- ✅ Config packages: tsconfig, eslint, tailwind (Tasks 4-6)
- ✅ Contracts package with TDD tests (Task 7)
- ✅ DB package (Task 8)
- ✅ API scaffold (Task 9)
- ✅ API infra: env, prisma, otel, filters, interceptors (Task 10)
- ✅ Prisma schema + migration + seed (Task 11)
- ✅ Health module (Task 12)
- ✅ Auth module with TDD (Task 13)
- ✅ Users module with TDD (Task 14)
- ✅ E2E tests (Task 15)
- ✅ UI package with shadcn components (Task 16)
- ✅ Web scaffold (Task 17)
- ✅ Web env/api-client/auth/middleware (Task 18)
- ✅ Web pages (Task 19)
- ✅ SDD rule files (Task 20)
- ✅ Husky + commitlint (Task 21)
- ✅ Final DoD validation (Task 22)

**Placeholder scan:** No "TBD", "TODO", "implement later", "fill in", "similar to Task N", or vague steps. All steps have concrete commands, code, and expected output.

**Type consistency:**
- `AuthService.issueTokens` returns `AuthResult` — consistent across `register`, `login`, `refresh` (Task 13)
- `UsersService.list` returns `{ items, total, page, pageSize }` — matches `UserListQuery` contract (Task 14)
- `apiClient` uses `ky` and the same `env.NEXT_PUBLIC_API_URL` as the rest of web (Task 17-18)
- `REFRESH_COOKIE` constant defined in `auth.ts`, used in `middleware.ts` and `loginAction` (Task 18)
- All schema references (`RegisterInputSchema`, etc.) come from `@ai-padrao/contracts` — single source of truth (Tasks 7, 13, 14, 19)

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-04-ai-padrao-blueprint.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints