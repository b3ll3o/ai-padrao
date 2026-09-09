# OpenSpec changelog

Archives of approved changes, in reverse chronological order. Each entry records
the date the change was archived, the feature name, the architectural summary,
the merged commits that shipped it, and the author of the archival work.

## 2026-09-09 — harness-removal

- **Feature:** `harness-removal`
- **Author:** Claude Code (cleanup pass)
- **Spec delta:** none — this is a removal, not a behavior change.

### Summary

Removed the `.harness/` self-improving agent loop from the project. The harness
added significant complexity (capture/detect/digest pipelines, codemods,
INC-XXX tracking, complexity gate, post-merge workflow) and is no longer
considered worth its operational cost on a blueprint-scale project.

### What changed

- Deleted `.harness/` (capture/detect/digest scripts, pattern_match.py, redact.py, INCIDENTS.md, learnings.json, codemods/, graph/, loop/).
- Deleted `.openspec/specs/harness/` (complexity-gate, post-merge-pull-workflow, inc-017, inc-024).
- Deleted ADRs that existed only because of the harness: ADR-008 (capture scripts), ADR-009 (events gitignored), ADR-010 (daily digest), ADR-018 (documentation coverage skill).
- Removed `harness:*` scripts and the `prebuild` hook from `package.json`.
- Simplified `.githooks/pre-push` to `lint + typecheck + test` (removed docker compose up, postgres wait, e2e).
- Simplified `.githooks/post-merge` to `pnpm install` on `pnpm-lock.yaml` change (removed harness:check, db:migrate, runtime tests).
- Updated `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `.openspec/AGENTS.md`, `.githooks/README.md`, `docs/decisions/README.md`, `.claude/skills/ddd-hexagonal/SKILL.md`, `.claude/skills/ddd-hexagonal/CHECKLIST.md`.

### What is preserved

The policies the harness enforced (no skipped tests, no `console.*` in main.ts,
no Express response API under Fastify, no default well-known host ports,
no `import type` for Nest DI) are still required. They live in
`docs/decisions/ADR-*.md` and `AGENTS.md`. Reviewers and CI enforce them
manually.

## 2026-08-04 — ddd-hexagonal-coverage

- **Feature:** `ddd-hexagonal-coverage`
- **Author:** Claude (subagent)
- **Archived spec:** `.openspec/specs/architecture/ddd-hexagonal-coverage.md`

### Summary

Adopted DDD and hexagonal architecture across `apps/api` and `apps/web` and
enforced independent 80% coverage gates (statements, branches, functions, and
lines) for each app. Verified that domain code remains framework-free, that
application code depends on outbound capabilities through ports, and that all
public API/web contracts (routes, status codes, Zod schemas, cookie names, JWT
claims, token rotation, web routes) are preserved.

The migration shipped incrementally across 15 tasks plus a follow-up fix wave:

1. `2e5b46a` — `docs(sdd): propose DDD hexagonal migration and coverage gate`
2. `798ee43` — `chore(deps): add per-app coverage baseline tooling`
3. `c14e636` — `test(root): characterize auth and users before architecture migration`
4. `98b0fc5` — `chore(config): enforce hexagonal dependency direction`
5. `b2909ee` — `feat(api): add users domain model and repository port`
6. `21d8930` — `feat(api): add users application use cases`
7. `fe77708` — `feat(api): add prisma users adapter and mapper`
8. `06e4706` — `feat(api): swap users http adapter to contexts/users`
9. `8f45115` — `feat(api): add auth domain ports and use cases`
10. `4c8215b` — `feat(api): add auth infrastructure adapters`
11. `c7433f2` — `feat(api): swap auth http adapter to contexts/auth`
12. `1876a61` — `refactor(web): migrate auth to ports and adapters`
13. `2258234` — `test(root): enforce 80 percent coverage per app and metric`
14. `7985524` — `fix(api): cast through unknown in logging interceptor spec`
15. `1b7ed77` — `docs(sdd): document hexagonal contexts and coverage enforcement`

All 15 plan tasks are complete. Sub-tasks 2 and 3 (coverage baselines and
characterization tests) were intentionally left unchecked in the original
proposal because they were superseded by the dedicated commits above and are
not required for the archived capability. The final archival commit (Task 15.5)
closes out the change folder.

## OpenSpec Changelog

Archived specs in `.openspec/specs/<area>/<feature>.md` are the source of
truth. Entries here record when each spec moved from `changes/` to `specs/`.

## 2026-08-04

- **inc-017-detector-excludes-docs** — `.harness/pattern_match.py` (L2
  detector) now excludes documentation-path Write events from the
  file-axis computation while preserving them in the symbol-axis
  combined blob. Prevents INC-002/INC-003 false positives when agents
  edit `docs/decisions/`, `.harness/INCIDENTS.md`, or
  `.harness/learnings.json`. Spec archived at
  `.openspec/specs/harness/inc-017-detector-excludes-docs.md`.
  Implementation tasks 1–6 (INCIDENTS.md, learnings.json,
  pattern_match.py, test_pattern_match.py, check.sh wire-up, full
  green run) completed; PASS=15, SKIP=3.

## 2026-08-05

- **domain-audit-foundation** — Every domain entity (now `User`,
  future bounded contexts) ships with `id`, `createdAt`, `updatedAt`,
  `deletedAt`, `version`, plus a typed `<entity>_history` table. Audit
  extension lives at `apps/api/src/infra/prisma/audit/` and is bound
  once in `PrismaModule` via a Prisma Client extension. New routes:
  `PATCH /api/users/:id/restore` and `GET /api/users/:id/history`.
  Spec archived at
  `.openspec/specs/api/domain-audit-foundation.md`. Linked to
  [ADR-014](../docs/decisions/ADR-014-domain-audit-foundation.md).

- **inc-024-detector-type-vs-di** — Closes the INC-024 + INC-025 gap on
  the L2 detector's `import type` heuristics. (1) INC-025: file-axis
  globs now match the file path only via the new
  `_file_path_for_axis(event)` helper, not Write/Edit content
  (structural). (2) INC-024: AST-lite brace classifier
  (`classify_import_type_binding`) marks suffix-marked bindings
  (Type, Interface, Dto, Context, Spec, Map, Key, Schema) as
  `type-only-safe` and suppresses INC-003. Class-DI-risk bindings
  (e.g. `FindUserUseCase`, `User`, `PrismaService`) still fire.
  Spec archived at
  `.openspec/specs/harness/inc-024-detector-type-vs-di.md`. Linked to
  INC-024 + INC-025 in `.harness/INCIDENTS.md`.

- **post-merge-pull-workflow** — Opt-in `.githooks/post-merge` hook
  runs the validation steps implied by files changed in a merge
  (including `git pull`): `pnpm-lock.yaml` → `pnpm install
  --frozen-lockfile`; `apps/api/prisma/**` → `pnpm db:migrate`;
  `.harness/**` → `pnpm harness:check`; runtime source changes →
  `pnpm test`. Hook is enabled by `pnpm postmerge:install`
  (idempotent, sets `core.hooksPath`); locally disabled via
  `git config --local --unset core.hooksPath`. Spec archived at
  `.openspec/specs/harness/post-merge-pull-workflow.md`. Hook shipped
  in commits `ff0acf0` (scaffolding), `866dba8` (script),
  `48897da` (postmerge:install), `346615e` (quickstart docs).

- **ddd-hexagonal-audit-fixes** — Round 1 of audit findings against the
  ddd-hexagonal skill. Closes: (F1) two untested use cases in the
  `users` context (`GetUserHistoryUseCase`, `RestoreUserUseCase`) now
  have unit specs; (F2) `AUTH_CONTEXT_CONFIG` migrated from a plain
  string token to `Symbol("AuthContextConfig")` in
  `auth-context.tokens.ts`; (F3) `jwt-access-token.issuer.ts` switched
  from `import type` to a runtime `import` for its `JwtService`
  constructor parameter, matching the convention used by every other
  DI-consuming file in the project. No runtime behavior change. All
  four verification gates green: `pnpm test` 204/204, `pnpm lint`
  5/5, `pnpm typecheck` 6/6, `pnpm harness:check` 16 PASS / 0 FAIL.
  Spec archived at
  `.openspec/specs/api/ddd-hexagonal-audit-fixes.md`. Shipped in 5
  commits (`5124e35` spec F1.a, `3a7515e` spec F1.b, `dab14f9`
  refactor F2, `87751fb` refactor F3, `3f09e00` lint cleanup).

- **complexity-gate** — Adds a permanent cyclomatic-complexity gate at
  threshold 10 (SonarSource default). Three layers of defense: (a)
  ESLint's built-in `complexity` rule in `packages/config-eslint/base.js`
  is inherited by every workspace config, so `pnpm lint` (turbo) fails
  per-workspace on any function over the threshold; (b) new INC-027 in
  `.harness/check.sh` runs the same check at the repo level (fails
  `pnpm harness:check`); (c) new `.githooks/pre-push` script blocks
  `git push` locally with the same rule. Tool choice: ESLint built-in
  (zero new dep). Numbering note: the proposal originally cited
  INC-019, but INC-019..INC-022 are reserved slots in the L2 detector
  sub-check labeling — the next free incident slot is INC-027.
  Spec archived at
  `.openspec/specs/harness/complexity-gate.md`. Shipped in 4 commits:
  `1a9252d` config rule, `01ebd1a` INC-027, `5f265a0` pre-push hook,
  archive commit below. Verified gates: `pnpm test` 204/204, `pnpm lint`
  5/5 (forced, no turbo cache), `pnpm typecheck` 6/6 (forced),
  `pnpm harness:check` 17 PASS / 0 FAIL. Baseline: zero existing
  functions exceeded the threshold, so the gate was safe to enable
  without remediation.

- **pre-push-test-gate** — Extends `.githooks/pre-push` with four new
  ordered steps after the existing complexity check: (1) `pnpm up`
  (idempotent `docker compose up -d`); (2) Postgres readiness wait,
  auto-selecting the strongest available probe (pg_isready → psql
  → bash `/dev/tcp`); (3) `pnpm test` (turbo, unit + integration
  across all workspaces); (4) `pnpm --filter @ai-padrao/api test:e2e`
  against the just-brought-up Postgres. Toolchain check extended to
  require `docker`. Bypass unchanged: `git push --no-verify`. Spec
  archived at `.openspec/specs/harness/pre-push-test-gate.md`.
  Shipped in commit `a958b8c`. Verified gates: `pnpm test` 204/204,
  `pnpm lint` 5/5 (forced), `pnpm typecheck` 6/6 (forced),
  `pnpm harness:check` 17 PASS / 0 FAIL. Real `git push origin main`
  exercised the hook end-to-end (5 steps, 12 s, push succeeded).
  Red-green verified per DoD: failing unit test → step 4 FAIL;
  failing e2e test → step 5 FAIL; paused Postgres → TCP probe
  passes (intentionally weak), step 5 catches the real failure.
