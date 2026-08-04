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
- ❌ **Bypass the harness inline detector.** If the inline detector surfaces a known INC pattern, do not silently proceed — confirm with the user that the pattern is intentional. See [Continuous learning](#continuous-learning) below.
- ❌ **Add `jq` (or any new top-level binary dep) to a capture hook.** Capture scripts must use bash + `python3` only. See [Continuous learning → Capture dependencies](#capture-dependencies) below.

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
pnpm harness:check    # run all 16 auto-checks (also runs on prebuild)
pnpm harness:digest   # write today's digest + propose safe updates
pnpm harness:apply    # apply a proposed patch under .harness/proposed/
pnpm harness:codemod  # invoke a codemod (e.g. inc-002-fastify-response)
pnpm harness:test     # run codemod unit tests
```

## No skipped tests

**Zero tolerance.** The repo MUST NOT contain any skipped, disabled, or stubbed test. Concretely, none of the following are permitted in any tracked file:

| Pattern                                         | Examples                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| Jest/Vitest `.skip()`                           | `it.skip(...)`, `test.skip(...)`, `describe.skip(...)`            |
| `xit` / `xdescribe` / `xtest`                   | the `x`-prefixed aliases                                          |
| `test.todo()` / `it.todo()`                     | "I promise to write this later" — write it now or don't write it  |
| Empty spec files                                | `*.spec.ts` / `*.test.ts` containing zero `it()` / `test()` calls |
| Trivial-pass placeholders                       | `it('placeholder', () => { expect(true).toBe(true); })`           |
| Runner flags that mask empty suites             | `--passWithNoTests`, `vitest --passWithNoTests`                   |
| E2E tests skipped because infra is "down"       | e.g. `it.skipIf(!db)` — bring the infra up or don't ship the test |
| Vitest config `test.skip`                       | `test: { skip: true }` in any `vitest.config.*`                   |
| Conditional `describe` / `it` based on env vars | `if (process.env.X) describe(...)` — fix the env or fix the test  |

### Why

A skipped test is a lie. It says "this is covered" while delivering zero signal. We learned this the hard way during stabilization: every green build hid at least one assumption that wasn't actually exercised (see [`.harness/INCIDENTS.md`](.harness/INCIDENTS.md) INC-005 — `/api/health` was "covered" by tests but in fact 401'd because no e2e test ever called it without a token).

### What to do instead

- The behavior isn't ready yet → **don't write the test yet**. Add it as a task in the relevant `.openspec/changes/<feature>/tasks.md` and ship it together.
- The behavior needs a missing piece (env, secret, infra) → **add the missing piece first**, then add the test.
- The test would be flaky → **fix the root cause** (test isolation, factory fixtures, transaction rollback). Never paper over it with `.skip`.
- The test depends on an external service that isn't always available → **mock it deterministically** with the test factory, or **use Testcontainers** to make it available.

### Enforcement

The auto-check [`.harness/check.sh`](.harness/check.sh) entry **INC-012** scans every `*.spec.ts`, `*.test.ts`, `*.spec.tsx`, `*.test.tsx`, and `package.json` for the patterns above and fails the build if any match. CI runs the same check before tests run.

## Continuous learning

The harness is a **closed feedback loop** — it learns from every event that happens in this repo, not only from escaped defects. The model is: **agente = modelo + harness**, where the harness has two halves:

- **Guias (feedforward):** tell the agent the safe form BEFORE it writes the bad form. Codemods in `.harness/codemods/` and the inline detector (L2) are guias.
- **Sensores (feedback):** observe what the agent did and surface it. Capture (L1), daily digest (L3), auto-checks (L4) are sensores.

### The four layers

```
┌────────────────────────────────────────────────────────────────────────┐
│ L1 — Capture (sensor)                                                   │
│   PostToolUse hooks on Bash|Edit|Write|MCP append one JSONL line        │
│   to .harness/events/<date>.jsonl. Tokens redacted via redact.py.       │
│   Always exit 0 — capture failures must never block the user.           │
└────────────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────────────┐
│ L2 — Inline detection (guia)                                            │
│   detect.sh tails last 20 events, runs pattern_match.py.                │
│   Match against .harness/learnings.json trigger_patterns →              │
│   blocking confirmation prompt to the assistant.                        │
└────────────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────────────┐
│ L3 — Daily digest (sensor)                                              │
│   CronCreate @ 22:03 local runs an agent that reads events/*.jsonl,     │
│   writes .harness/digest/<date>.md, and proposes updates to            │
│   learnings.json / AGENTS.md / skills under .harness/proposed/<date>.patch. │
│   Safe promotions auto-apply via pnpm harness:apply.                    │
└────────────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────────────┐
│ L4 — Enforcement (sensor)                                               │
│   .harness/check.sh runs all 16 auto-checks (INC-001..INC-016)         │
│   before every build. New auto-checks are added when an INC pattern     │
│   re-occurs and the existing prevention isn't strong enough.            │
└────────────────────────────────────────────────────────────────────────┘
```

### How the inline detector works

When the agent is about to edit, write, or run a bash command, the L2 hook tails the last 20 events and compares them against `trigger_pattern` for every entry in `learnings.json`. If a match is found:

1. The hook exits non-zero with a message like `harness-detect: matched INC-006 in recent events — confirm with user before proceeding`.
2. Claude Code surfaces the warning to the assistant.
3. The assistant MUST stop, explain the matched pattern, and ask the user to confirm or override.

**The user can always say "yes, proceed" — the detector is a guide, not a wall.** But bypassing the warning without acknowledging the known pattern is a forbidden action.

### Codemods as feedforward guides

For each `INC-XXX` whose pattern is regular enough to rewrite deterministically, we ship a codemod under `.harness/codemods/inc-XXX-…`. The agent SHOULD invoke the codemod before editing a file that matches the INC `trigger_pattern.files`, OR during a fix wave to eliminate every existing instance:

```bash
# Dry-run: show the proposed rewrite
pnpm harness:codemod inc-002-fastify-response --check apps/api/src/modules/audit/audit.interceptor.ts

# Apply the rewrite
pnpm harness:codemod inc-002-fastify-response --apply apps/api/src/modules/audit/audit.interceptor.ts
```

The codemods are documented in [`.harness/codemods/README.md`](.harness/codemods/README.md). When you add a new INC, ask: "is this pattern regular enough to rewrite deterministically?" If yes, add a codemod as part of the prevention layer.

### Capture dependencies

All capture scripts (`.harness/capture.sh`, `.harness/detect.sh`, `.harness/digest.py`, `.harness/pattern_match.py`, `.harness/redact.py`) MUST use bash + `python3` only. Adding `jq` (or any other top-level binary dep) to a capture hook is a forbidden action.

The auto-check **INC-013** in `.harness/check.sh` enforces this:

- Asserts `python3` is present.
- Greps every capture script for `jq` and fails if any match.
- Error message: _"Fix: jq missing/broken; use python3 (see .harness/redact.py)"_ — the Alura principle of "linter messages with correction instructions."

The original Prettier PostToolUse hook depended on `jq` and was silently a no-op for months (see [`.harness/INCIDENTS.md`](.harness/INCIDENTS.md) INC-013). We rewrote it to use `python3 -c 'import json,sys; ...'`.

### Events are transient

`.harness/events/<date>.jsonl` is session state, NOT source-of-truth. It MUST be gitignored. The aggregated output (`.harness/digest/<date>.md`) and the proposed patches (`.harness/proposed/<date>.patch`) ARE source-of-truth and stay committed.

The auto-check **INC-014** in `.harness/check.sh` asserts the `.gitignore` entry is present.

### Daily digest freshness

The daily digest must run. If the newest `.harness/digest/*.md` is more than 25 hours old, the harness has stopped learning.

The auto-check **INC-015** in `.harness/check.sh` enforces this:

- Asserts `.harness/digest/` exists.
- Asserts the newest digest mtime is < 25h.
- Error message: _"Fix: run `pnpm harness:digest` to refresh the daily digest."_

### No plaintext secrets

`~/.claude/settings.json` on this machine carries a live `ANTHROPIC_AUTH_TOKEN` (`sk-cp-…`) and `GITHUB_PERSONAL_ACCESS_TOKEN` (`github_pat_…`) in plaintext. Any hook that captures tool inputs without redaction risks writing these tokens to disk. The two-layer defense:

1. **Redaction at capture (seatbelt).** `.harness/redact.py` strips tokens before they hit `.harness/events/`. Run on every Bash/Edit/Write/MCP via the L1 hook.
2. **Secret-shape scan at pre-commit (airbag).** The auto-check **INC-016** in `.harness/check.sh` greps every `*.ts`/`*.tsx`/`*.js`/`*.jsx` under `apps/` and `packages/` for known token shapes (`sk-ant-`, `sk-cp-`, `ghp_`, `github_pat_`, `AKIA…`) and fails the build.

### When the inline detector fires

1. Acknowledge the matched `INC-XXX` to the user.
2. State the recommended remediation (run the codemod, or apply the fix manually).
3. Ask: "Continue anyway, or apply the fix?"
4. If the user says continue, do so — but the matched INC is now extra evidence for the next self-improvement pass.

Bypassing the detector without acknowledging the pattern is a forbidden action.
