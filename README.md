# ai-padrao

Monorepo blueprint: **Next.js 15 + NestJS 11 + PostgreSQL 16**, fully Dockerized, SDD-driven.

## Quickstart (5 minutes)

Requires Docker, Docker Compose, and Node 22+.

```bash
git clone <repo-url> my-project
cd my-project
corepack enable
pnpm install
pnpm postmerge:install   # opt-in: enables .githooks/post-merge
cp .env.example .env
pnpm up
pnpm db:migrate
pnpm db:seed
```

`pnpm postmerge:install` is a one-time command that sets
`git config core.hooksPath .githooks` for the local clone. After every
`git pull` (or merge), the hook runs the validation steps implied by the
files that changed — `pnpm install` if `pnpm-lock.yaml` moved, for
example. See [`.githooks/README.md`](.githooks/README.md) for the full
design. Opt out with `git config --local --unset core.hooksPath`.

Open:

| Service    | URL                          |
| ---------- | ---------------------------- |
| Web app    | <http://localhost:3000>      |
| API        | <http://localhost:3001>      |
| Swagger UI | <http://localhost:3001/docs> |
| MailHog UI | <http://localhost:18025>     |

Default seed user: `admin@ai-padrao.local` / `admin123`.

## Stack

| Layer         | Choice                                                                       |
| ------------- | ---------------------------------------------------------------------------- |
| Monorepo      | pnpm 9 + Turborepo 2 workspaces                                              |
| Backend       | NestJS 11 on Fastify + Prisma 6 + Zod (`nestjs-zod`)                         |
| Frontend      | Next.js 15 (App Router) + Tailwind 4 + shadcn/ui                             |
| Auth          | JWT (15m access) + rotated refresh in httpOnly cookie + Argon2id             |
| Database      | PostgreSQL 16                                                                |
| Observability | OpenTelemetry SDK + OTLP Collector                                           |
| Email (dev)   | MailHog (host ports `11025` / `18025` to avoid sibling collisions)           |
| Container     | 5-service `docker-compose.yml` (postgres, api, web, mailhog, otel-collector) |
| Editor        | Visual Studio Code (workspace config in `.vscode/`)                          |

## Architecture

See [`docs/superpowers/specs/`](docs/superpowers/specs/) for the full design spec.

| App / Package            | Purpose                          |
| ------------------------ | -------------------------------- |
| `apps/api`               | NestJS 11 + Fastify REST API     |
| `apps/web`               | Next.js 15 (App Router) frontend |
| `packages/db`            | Prisma client re-export          |
| `packages/contracts`     | Zod schemas shared front + back  |
| `packages/ui`            | shadcn/ui components             |
| `packages/config-eslint` | Shared flat ESLint 9 configs     |

## Spec-Driven Development (mandatory)

Every new feature MUST follow the **SDD (Specification-Driven Development)** workflow via OpenSpec. Before writing code, create `.openspec/changes/<feature-name>/` with `proposal.md`, `tasks.md`, `design.md`, and a spec delta under `specs/<area>/spec.md`. Wait for human approval, then implement.

Full workflow + templates: [`AGENTS.md`](AGENTS.md) and [`.openspec/AGENTS.md`](.openspec/AGENTS.md).

## Project policies (zero-tolerance)

The repo enforces several "zero-tolerance" policies. They are documented in [AGENTS.md](AGENTS.md) and enforced by code review + CI:

- ❌ **No skipped tests** — `it.skip`, `xit`, `xdescribe`, `xtest`, `it.todo`, `--passWithNoTests`, and conditional `describe/it` are all forbidden. Tests are real or they don't exist.
- ❌ No `console.*` in `apps/api/src/main.ts` — use the Nest `Logger`.
- ❌ No Express-only response API (`res.setHeader`, `res.cookie`) under Fastify.
- ❌ Default well-known host ports (1025, 8025, 3000, 5432, etc.) in `docker-compose.yml` — they collide with sibling projects.
- ❌ `import type` for class references in NestJS DI'd files (controllers, services, guards, strategies, interceptors, decorators).

Every change that touches these areas MUST be reviewed against the matching ADR before merge.

## Scripts

| Command           | What it does                                |
| ----------------- | ------------------------------------------- |
| `pnpm up`         | Start all Docker services                   |
| `pnpm down`       | Stop all services                           |
| `pnpm logs`       | Tail logs from all services                 |
| `pnpm db:migrate` | Apply Prisma migrations (in api container)  |
| `pnpm db:seed`    | Run seed script                             |
| `pnpm db:reset`   | Reset DB + re-run migrations + seed         |
| `pnpm build`      | Build all packages                          |
| `pnpm dev`        | Run all dev servers                         |
| `pnpm test`       | Run unit + e2e tests across packages        |
| `pnpm lint`       | Lint all packages                           |
| `pnpm typecheck`  | TypeScript checks across packages           |
| `pnpm clean`      | Wipe dist, `.next`, `.turbo`, `node_modules` |

## Conventions

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) with `commitlint` + `husky` + `lint-staged`. Allowed scopes (per [`.commitlintrc.json`](.commitlintrc.json)): `root`, `api`, `web`, `contracts`, `db`, `ui`, `config`, `docker`, `sdd`, `deps`.
- **Branches:** Trunk-based; default branch is `main`.
- **Editor:** VSCode. Workspace settings in [`.vscode/settings.json`](.vscode/settings.json) (format-on-save, ESLint flat config, monorepo-aware); recommended extensions in [`.vscode/extensions.json`](.vscode/extensions.json).
- **AI-assistant rules:** Single source of truth is [`AGENTS.md`](AGENTS.md). Claude Code, Gemini CLI, Codex, and any other AI assistant working in this repo all read the same file.

## Further reading

- [`AGENTS.md`](AGENTS.md) — the SDD workflow, forbidden actions, and editor config.
- [`docs/decisions/README.md`](docs/decisions/README.md) — the ADR index.
- [`docs/superpowers/specs/2026-08-04-ai-padrao-blueprint-design.md`](docs/superpowers/specs/2026-08-04-ai-padrao-blueprint-design.md) — the design spec that started it all.
- [`docs/superpowers/plans/2026-08-04-ai-padrao-blueprint.md`](docs/superpowers/plans/2026-08-04-ai-padrao-blueprint.md) — the implementation plan.
