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
- MailHog: http://localhost:8025

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
