# ai-padrao

Monorepo blueprint: **Next.js 15 + NestJS 11 + PostgreSQL 16**, fully Dockerized, SDD-driven, with a self-improving harness that learns from real defects.

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
files that changed — `pnpm install` if `pnpm-lock.yaml` moved, `pnpm db:migrate`
if a Prisma schema changed, `pnpm harness:check` if harness internals
moved, `pnpm test` if runtime source moved. See
[`.githooks/README.md`](.githooks/README.md) for the full design. Opt out
with `git config --local --unset core.hooksPath`.

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

## Self-improving harness

The `.harness/` directory is a **closed feedback loop** that turns real defects into durable guardrails AND learns from every tool call in this repo. The model is **agente = modelo + harness**, with two halves:

- **Guias (feedforward):** tell the agent the safe form BEFORE it writes the bad form. Codemods in `.harness/codemods/` are guias.
- **Sensores (feedback):** observe what the agent did and surface it. Capture (L1), inline detection (L2), daily digest (L3), auto-checks (L4) are sensores.

```
every tool call → L1 Capture ─→ L2 Inline detect ─→ L3 Daily digest ─→ L4 Auto-check
                    ↓                  ↓                    ↓                  ↓
              .harness/events/  match → confirmation  .harness/digest/   .harness/check.sh
                                   prompt + codemod  + .harness/proposed/  (16 checks)
                                     applied                                     ↓
                                                                       blocks reincarnation
```

### The four layers

| Layer                  | What it does                                                                          | Where it lives                                                     |
| ---------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **L1 — Capture**       | Append one JSONL line per tool call (after `redact.py`)                               | `.harness/capture.sh` + `~/.claude/settings.json` PostToolUse hook |
| **L2 — Inline detect** | Compare last 20 events against `learnings.json`; match → blocking confirmation prompt | `.harness/detect.sh` + `.harness/pattern_match.py`                 |
| **L3 — Daily digest**  | Cron @ 22:03 local: aggregate events → markdown digest + proposed patch               | `.harness/digest.py` (CronCreate)                                  |
| **L4 — Enforce**       | All 15 auto-checks (`INC-001`..`INC-017`) before every build                          | `.harness/check.sh` (wired into `pnpm prebuild`)                   |

### The data flow

- **`.harness/INCIDENTS.md`** — narrative log of every real defect that escaped review (17 entries to date).
- **`.harness/learnings.json`** — structured DB mapping `trigger_pattern` → `prevention` → `auto_check`.
- **`.harness/events/`** — _session state, gitignored_. Per-day NDJSON. Don't commit.
- **`.harness/digest/`** — _committed_. Daily digest the human reviews.
- **`.harness/proposed/`** — _committed_. Unified-diff patches the daily agent proposes.
- **`.harness/codemods/`** — _committed_. Feedforward transformations for known-safe rewrites (e.g. `inc-002-fastify-response` rewrites `res.setHeader` → `reply.header`).
- **`.harness/check.sh`** — runs all auto-checks before every build. Currently 15 PASS / 0 FAIL / 3 SKIP (manual).

To run: `pnpm harness:check`. Wired into `pnpm prebuild`, so any build will block on a regression.

### Available harness scripts

| Command                                         | What it does                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm harness:check`                            | Run all 15 auto-checks                                                      |
| `pnpm harness:detect`                           | Run the inline pattern detector once (no-op if no event in last 20 matches) |
| `pnpm harness:digest`                           | Generate today's digest + proposed patch (manual run of the L3 agent)       |
| `pnpm harness:apply`                            | Apply today's proposed patch (refuses forbidden paths)                      |
| `pnpm harness:codemod inc-XXX … --check <file>` | Show the safe rewrite for file                                              |
| `pnpm harness:codemod inc-XXX … --apply <file>` | Apply the safe rewrite                                                      |

## Project policies (zero-tolerance)

The repo enforces several "zero-tolerance" policies via harness auto-checks. They are documented in [AGENTS.md](AGENTS.md) and enforced by [`.harness/check.sh`](.harness/check.sh):

- ❌ **No skipped tests** — `it.skip`, `xit`, `xdescribe`, `xtest`, `it.todo`, `--passWithNoTests`, and conditional `describe/it` are all forbidden. Tests are real or they don't exist. _Enforced by INC-012._
- ❌ No `console.*` in `apps/api/src/main.ts` — use the Nest `Logger`. _Enforced by INC-009._
- ❌ No Express-only response API (`res.setHeader`, `res.cookie`) under Fastify. _Enforced by INC-002._
- ❌ Default well-known host ports (1025, 8025, 3000, 5432, etc.) in `docker-compose.yml` — they collide with sibling projects. _Enforced by INC-008._
- ❌ `import type` for class references in NestJS DI'd files (controllers, services, guards, strategies, interceptors, decorators). _Enforced by INC-003 (manual)._

Every change that touches these areas MUST be reviewed against the matching skill before merge.

## Scripts

| Command              | What it does                                      |
| -------------------- | ------------------------------------------------- |
| `pnpm up`            | Start all Docker services                         |
| `pnpm down`          | Stop all services                                 |
| `pnpm logs`          | Tail logs from all services                       |
| `pnpm db:migrate`    | Apply Prisma migrations (in api container)        |
| `pnpm db:seed`       | Run seed script                                   |
| `pnpm db:reset`      | Reset DB + re-run migrations + seed               |
| `pnpm build`         | Build all packages (runs harness check first)     |
| `pnpm dev`           | Run all dev servers                               |
| `pnpm test`          | Run unit + e2e tests across packages              |
| `pnpm lint`          | Lint all packages                                 |
| `pnpm typecheck`     | TypeScript checks across packages                 |
| `pnpm harness:check` | Run the harness auto-checks (always before build) |
| `pnpm prebuild`      | Same as `harness:check` — wired into build        |
| `pnpm clean`         | Wipe dist, `.next`, `.turbo`, `node_modules`      |

## Conventions

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) with `commitlint` + `husky` + `lint-staged`. Allowed scopes (per [`.commitlintrc.json`](.commitlintrc.json)): `root`, `api`, `web`, `contracts`, `db`, `ui`, `config`, `docker`, `sdd`, `deps`.
- **Branches:** Trunk-based; default branch is `main`.
- **Editor:** VSCode. Workspace settings in [`.vscode/settings.json`](.vscode/settings.json) (format-on-save, ESLint flat config, monorepo-aware); recommended extensions in [`.vscode/extensions.json`](.vscode/extensions.json).
- **AI-assistant rules:** Single source of truth is [`AGENTS.md`](AGENTS.md). Claude Code, Gemini CLI, Codex, and any other AI assistant working in this repo all read the same file.

## Further reading

- [`.harness/INCIDENTS.md`](.harness/INCIDENTS.md) — the 17 incidents that shaped the policies above.
- [`.harness/learnings.json`](.harness/learnings.json) — machine-readable incident DB.
- [`AGENTS.md`](AGENTS.md) — the SDD workflow, forbidden actions, and editor config.
- [`docs/superpowers/specs/2026-08-04-ai-padrao-blueprint-design.md`](docs/superpowers/specs/2026-08-04-ai-padrao-blueprint-design.md) — the design spec that started it all.
- [`docs/superpowers/plans/2026-08-04-ai-padrao-blueprint.md`](docs/superpowers/plans/2026-08-04-ai-padrao-blueprint.md) — the implementation plan.
