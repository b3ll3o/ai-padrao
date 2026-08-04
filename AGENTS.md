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
