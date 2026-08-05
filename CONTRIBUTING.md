# Contributing to ai-padrao

Thanks for contributing to `ai-padrao`. This guide covers the day-to-day
commands, validation expectations, and project conventions you need to ship a
change that lands cleanly on `main`.

## Project conventions

The single source of truth for AI-assistant and human contributor guardrails is
[`AGENTS.md`](./AGENTS.md). Before opening a PR, read it. In particular:

- **SDD is mandatory.** Every behavior change MUST start as
  `.openspec/changes/<feature>/` (proposal + design + tasks + spec delta) and
  wait for approval. Cosmetic edits, dependency bumps without API impact, and
  documentation fixes are the only exemptions — they still use Conventional
  Commits.
- **Conventional Commits** are enforced via commitlint and husky. Allowed
  scopes include `sdd`, `api`, `web`, `config`, `deps`, `root`, `infra`, etc.
  See the full list and commit body rules in `AGENTS.md`.
- **No skipped tests.** Zero-tolerance for `.skip`, `xit`, `xdescribe`,
  `test.todo`, empty spec files, trivial-pass placeholders, `--passWithNoTests`,
  conditional `describe`/`it` based on env, and similar patterns. The harness
  auto-check `INC-012` scans for these on every build.
- **DDD + hexagonal architecture.** Vertical bounded contexts, dependencies
  pointing toward the domain, framework and infrastructure isolated behind ports
  and adapters. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) and the per-app
  rules in [`apps/api/AGENTS.md`](./apps/api/AGENTS.md) and
  [`apps/web/AGENTS.md`](./apps/web/AGENTS.md).

## Quickstart

```bash
pnpm install            # install all workspace dependencies
pnpm up                 # start Postgres + Redis + the api container
pnpm dev                # run api + web in watch mode
```

Optional one-shots:

```bash
pnpm db:migrate         # apply Prisma migrations inside the api container
pnpm db:seed            # seed an admin user
pnpm logs               # tail Docker logs
pnpm down               # stop services
```

## Validation commands

Run these locally before opening a PR. CI runs the same sequence and fails the
build on the first non-zero exit:

| Command              | What it checks                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm harness:check` | All 16 harness auto-checks (`INC-001`..`INC-016`). Includes the skipped-test scan, secret-shape scan, and ESLint `--config` resolution. |
| `pnpm typecheck`     | `tsc --noEmit` across every workspace package.                                                                                          |
| `pnpm lint`          | ESLint 9 with the shared `@ai-padrao/config-eslint` rules (enforces hexagonal dependency direction).                                    |
| `pnpm test`          | Jest (api) and Vitest (web) unit suites. Output goes to per-app `coverage/`.                                                            |
| `pnpm test:coverage` | The aggregate coverage gate. Fails if **any one metric in any one app** falls below **80%**.                                            |
| `pnpm build`         | `turbo run build` — runs Nest build for the api and Next build for the web.                                                             |

### Suggested order

```bash
pnpm harness:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

`pnpm test` already produces coverage output; `pnpm test:coverage` runs the
configured thresholds against that output and is the single source of truth
for the gate in CI. Do not run full coverage from `prebuild` on top of CI to
avoid duplicate work — `prebuild` runs `pnpm harness:check`, which is
deliberately separate from the coverage gate.

## Definition of Done

A change is "done" only when **all** of the following hold:

1. Every command in the table above passes locally and on CI.
2. **No skipped, disabled, or stubbed tests.** `pnpm harness:check` enforces
   this — see the [No skipped tests](https://www.conventionalcommits.org/)
   section of `AGENTS.md` for the full list of forbidden patterns.
3. Each app (`apps/api`, `apps/web`) independently reports
   **statements ≥ 80%**, **branches ≥ 80%**, **functions ≥ 80%**, **lines ≥
   80%**. The gate is per-app and per-metric; another app or workspace cannot
   compensate for a shortfall.
4. The change is committed with a Conventional Commits header and the scope
   that matches its surface (`api`, `web`, `config`, `sdd`, etc.).
5. If the change alters behavior, `.openspec/changes/<feature>/` exists with
   `proposal.md`, `design.md`, `tasks.md`, and a spec delta — and every
   completed task is ticked `[x]`.

## Pull request flow

1. Branch off `main`. Use a descriptive name (e.g.
   `feat/auth-refresh-rotation`, `docs/architecture-overview`).
2. Make small, reviewable commits. Keep scope tight: one Conventional Commit
   header per logical change.
3. Run the full validation sequence locally before pushing.
4. Open a PR. The CI workflow at
   [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs
   `harness:check`, `typecheck`, `lint`, `test`, `test:coverage`, `build` in
   that order and is the source of truth for merge readiness.
5. Address review comments with follow-up commits; do not squash locally.
6. After merge, archive the OpenSpec change folder per `AGENTS.md` (see also
   `.openspec/AGENTS.md`).

## Where to look

- `AGENTS.md` — AI-assistant and contributor guardrails, harness model, no-skipped-tests policy.
- `ARCHITECTURE.md` — current architecture, layer responsibilities, ports and adapters, composition roots.
- `.openspec/AGENTS.md` — the SDD workflow, templates, and archival flow.
- `apps/api/AGENTS.md`, `apps/web/AGENTS.md` — per-app DDD and testing rules.
- `docs/decisions/` — Architecture Decision Records (ADRs).
- `.harness/` — the four-layer learning loop (capture → detect → digest → checks).
- `.harness/INCIDENTS.md` — past failures and the prevention we shipped for each.
