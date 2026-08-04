# ai-padrao — Project Rules for AI Agents

This file is read by Claude Code, Gemini CLI, Codex, and any other AI assistant working in this repo. (The team uses Visual Studio Code as the editor of record; workspace settings live in `.vscode/`.)

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
- ❌ **Skip, disable, or stub a test.** The repo uses zero-tolerance for skipped tests — see [No skipped tests](#no-skipped-tests) below.

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

## No skipped tests

**Zero tolerance.** The repo MUST NOT contain any skipped, disabled, or stubbed test. Concretely, none of the following are permitted in any tracked file:

| Pattern | Examples |
|---|---|
| Jest/Vitest `.skip()` | `it.skip(...)`, `test.skip(...)`, `describe.skip(...)` |
| `xit` / `xdescribe` / `xtest` | the `x`-prefixed aliases |
| `test.todo()` / `it.todo()` | "I promise to write this later" — write it now or don't write it |
| Empty spec files | `*.spec.ts` / `*.test.ts` containing zero `it()` / `test()` calls |
| Trivial-pass placeholders | `it('placeholder', () => { expect(true).toBe(true); })` |
| Runner flags that mask empty suites | `--passWithNoTests`, `vitest --passWithNoTests` |
| E2E tests skipped because infra is "down" | e.g. `it.skipIf(!db)` — bring the infra up or don't ship the test |
| Vitest config `test.skip` | `test: { skip: true }` in any `vitest.config.*` |
| Conditional `describe` / `it` based on env vars | `if (process.env.X) describe(...)` — fix the env or fix the test |

### Why

A skipped test is a lie. It says "this is covered" while delivering zero signal. We learned this the hard way during stabilization: every green build hid at least one assumption that wasn't actually exercised (see [`.harness/INCIDENTS.md`](.harness/INCIDENTS.md) INC-005 — `/api/health` was "covered" by tests but in fact 401'd because no e2e test ever called it without a token).

### What to do instead

- The behavior isn't ready yet → **don't write the test yet**. Add it as a task in the relevant `.openspec/changes/<feature>/tasks.md` and ship it together.
- The behavior needs a missing piece (env, secret, infra) → **add the missing piece first**, then add the test.
- The test would be flaky → **fix the root cause** (test isolation, factory fixtures, transaction rollback). Never paper over it with `.skip`.
- The test depends on an external service that isn't always available → **mock it deterministically** with the test factory, or **use Testcontainers** to make it available.

### Enforcement

The auto-check [`.harness/check.sh`](.harness/check.sh) entry **INC-012** scans every `*.spec.ts`, `*.test.ts`, `*.spec.tsx`, `*.test.tsx`, and `package.json` for the patterns above and fails the build if any match. CI runs the same check before tests run.
