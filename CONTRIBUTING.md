# Contributing to ai-padrao

Thanks for working on `ai-padrao`. This guide covers the day-to-day
mechanics — environment, workflow, and the rules the build enforces.
For the _why_, see [`AGENTS.md`](AGENTS.md), the
[decision records](docs/decisions/README.md), and the
[harness readme](.harness/README.md).

## 1. Dev environment

Requires:

- Node 22+ (`.nvmrc` / `engines.node` in `package.json`)
- pnpm 9 (`corepack enable` activates the pinned version)
- Docker + Docker Compose (for `postgres`, `mailhog`, `otel-collector`)
- Visual Studio Code (recommended; workspace config in `.vscode/`)

Bootstrap a fresh clone:

```bash
git clone <repo-url> my-project
cd my-project
corepack enable
pnpm install
cp .env.example .env
pnpm up           # start postgres + mailhog + otel-collector
pnpm db:migrate
pnpm db:seed      # creates admin@ai-padrao.local / admin123
pnpm dev          # turbo runs api + web concurrently
```

If `pnpm install` complains about peer deps, see ADR-001 / INC-001 in
the [decisions index](docs/decisions/README.md) before adding overrides.

## 2. Workflow (trunk-based, single PR per change)

1. Branch from `main`. Branch names are free-form, but prefer
   `feat/<short-slug>` or `fix/<short-slug>` for symmetry with the
   commit scope.
2. Make focused commits. One commit per task in `tasks.md` (see §3).
3. Open a PR. The PR description should reference the
   `.openspec/changes/<feature>/` folder that drove the change.
4. CI must be green before merge. CI runs `pnpm harness:check` plus
   `pnpm test`, `pnpm lint`, `pnpm typecheck`.
5. Squash or rebase-merge; keep `main` linear.

## 3. Behavior changes require OpenSpec (SDD)

Any change to user-visible behavior, public contracts (API surface,
DB schema, shared types), or business rules MUST go through OpenSpec
**before** code lands. See `.openspec/AGENTS.md` for the full
procedure.

The minimum:

```bash
mkdir -p .openspec/changes/<feature-name>/specs/<area>
# Write proposal.md, tasks.md, design.md, specs/<area>/spec.md
# Wait for human approval on the proposal
# Execute tasks.md, one commit per task
# After merge, archive per §5 of .openspec/AGENTS.md
```

Skip OpenSpec only for:

- Cosmetic changes (typos, formatting, refactors with no behavior impact)
- Dependency version bumps without API change
- Documentation-only updates

Even those still use Conventional Commits (§5).

## 4. Testing policy — no skipped tests, ever

`.harness/check.sh` (INC-012) scans every tracked `.ts/.tsx/.js/.jsx`
for `.skip`, `.todo`, `xit`, `xdescribe`, `--passWithNoTests`, and
vitest/jest `passWithNoTests` config. The check fails the build on
the first hit.

If a test is flaky, fix the flake. If a test is wrong, delete it and
write the correct one. If you genuinely cannot keep the test green
today, reference the incident in your PR and propose an ADR —
**do not** commit a `.skip`.

```bash
pnpm test                                 # run all unit + e2e
pnpm --filter @ai-padrao/api test path/to/spec.ts   # single test
```

## 5. Commits — Conventional Commits with scope

Format: `<type>(<scope>): <subject>` where `type` is one of `feat`,
`fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`,
`build`, `revert`. Scope comes from the allowlist in
[`.commitlintrc.json`](.commitlintrc.json):

`root`, `api`, `web`, `contracts`, `db`, `ui`, `config`, `docker`,
`sdd`, `deps`.

There is **no `harness` scope** — harness changes land under `root` or
`deps`. Subject is short, lowercase, no trailing period. Body explains
the _why_; trailers reference tasks and incidents:

```
feat(api): add POST /auth/refresh endpoint

Closes inc-013-task-2. Validates the refresh token, rotates it via
Prisma, returns a new access token in the response body and a new
refresh token in the httpOnly cookie.

Refs: INC-013, .openspec/changes/refresh-token-rotation/
```

Husky + lint-staged run Prettier and ESLint on commit. Husky also
runs `commitlint` via the `commit-msg` hook.

## 6. Code style

- **Prettier** is the source of truth for formatting (single quotes,
  2-space indent, trailing commas). The config lives in
  `packages/config-prettier`. Do not fight it.
- **ESLint 9 (flat config)** enforces code quality. Shared configs
  live in `packages/config-eslint`. The api package adds NestJS-
  specific rules; the web package adds React/Next.js rules.
- **TypeScript** strict mode is on everywhere. No `any` outside
  generated code; no `@ts-ignore` without an inline justification.
- **Module boundaries:** `apps/web` must NOT import from `apps/api`
  or `@prisma/client`. Only `apps/api` may use Prisma. The shared
  types live in `packages/contracts`.

## 7. Harness auto-checks

Before every `pnpm build`, `.harness/check.sh` runs 15 auto-checks
(`INC-001`..`INC-017`) plus 3 manual skips. The full list is in
[`.harness/README.md`](.harness/README.md). When a check fails:

1. Read the failure output. It names the file and the line.
2. Fix the underlying issue — do not edit the check to make it pass.
3. The matching ADR explains the rationale and the safe pattern.
4. If you disagree with the rule, propose an ADR change through
   `.openspec/changes/<adr-amendment>/` — don't bypass.

If the L2 inline detector (`pnpm harness:detect`) blocks your commit
with a known INC pattern, **confirm with a maintainer** before
proceeding. INC-017 already excludes `docs/` paths from the
file-axis match, so writing docs will not false-positive.

## 8. Adding dependencies

- New top-level dev dep at the root: add to `package.json`
  `devDependencies` and explain in the PR body.
- Runtime dep: add to the specific package's `dependencies`. Never
  add it at the root.
- New top-level binary dep for capture hooks is **forbidden** —
  see AGENTS.md §"Forbidden actions" and INC-013.
- For UI primitives, prefer extending `packages/ui` over adding to
  the web app directly.

## 9. Reporting issues

Open a GitHub issue with:

- Reproduction steps (commands, env vars, OS)
- Expected vs actual behavior
- The relevant log excerpt (`pnpm logs` output for backend issues)
- The closest existing INC number, if any (see
  `.harness/INCIDENTS.md`)

If the issue is a recurring defect that escaped review, file it with
the `incident` label and propose an INC entry in the PR.

## 10. Where to get help

- AI-assistant rules (Claude Code, Gemini CLI, Codex): [`AGENTS.md`](AGENTS.md)
- Claude Code orientation: [`CLAUDE.md`](CLAUDE.md)
- Decision records: [`docs/decisions/README.md`](docs/decisions/README.md)
- Harness internals: [`.harness/README.md`](.harness/README.md)
- OpenSpec workflow: [`.openspec/AGENTS.md`](.openspec/AGENTS.md)
- Project status and quickstart: [`README.md`](README.md)

For human help, mention `@<maintainer>` in the issue or PR.
