---
title: Documentation Skill ("Doc-as-Sensor")
date: 2026-08-05
status: approved (brainstorming exit)
scope: tooling (new skill + 1 new auto-check; no SDD proposal required because it is a developer-experience harness, not a behavior change)
audience: AI agents + human developers (equal weight)
framework: Diátaxis (tutorial / how-to / reference / explanation)
---

# Documentation Skill ("Doc-as-Sensor") — Design

## Goal

Make every change in this repo **carry its own documentation** by default, and make the project's documentation coverage **continuously auditable**. Specifically:

1. A globally-installable Claude skill (`~/.claude/skills/documentation/`) that auto-activates when the agent edits code or docs.
2. The skill classifies every change into one of the four Diátaxis quadrants and enforces that the corresponding artifact (JSDoc / ADR / README / OpenSpec spec / runbook) exists.
3. A manual `audit` mode produces a coverage report and (optionally) fills the gaps in parallel.
4. A new `.harness/check.sh` entry (`INC-018-doc-coverage`) fails the build if any bounded context lacks a README or if a touched file drops below 80% JSDoc coverage on its public surface.

## Background / motivation

`ai-padrao` already invested heavily in self-improving tooling (`.harness/` with capture → detect → digest → auto-check). Documentation is the **weakest guia**: it lives in `AGENTS.md` only by convention, has no auto-check, and there is no enforced mapping from "new export" to "where the doc for this lives".

A 2026-08-04 audit fixed the *current* doc drift in one shot. Without a continuing mechanism, the same drift will reappear within a sprint. This skill makes documentation a sensor + enforcement layer analogous to the no-skipped-tests rule (ADR-007 / INC-012).

## Audience and framework (locked from brainstorming)

- **Audience:** AI agents and human developers, equal weight. Means: docs must be both machine-readable (clear structure, anchors, JSDoc tags) and human-readable (narrative where it helps).
- **Framework:** **Diátaxis** — every artifact is one of: `tutorial`, `how-to`, `reference`, `explanation`. The skill enforces the quadrant, not the prose style.
- **Scope:** full surface — JSDoc inline + READMEs per bounded context + ADRs + OpenSpec specs + operational runbooks.
- **Trigger:** auto-trigger (fires on Edit/Write tool calls under `apps/`, `packages/`, `docs/`, `.openspec/`, `infra/`) plus a manual `/documentar` audit command.

## Architecture

Two modes share one brain — a **classification matrix** that maps `(file path, change type) → (Diátaxis quadrant, target artifact location, template)`.

### Mode 1 — Auto-sensor (every tool call)

Trigger conditions (Edit / Write / NotebookEdit on a tracked file):

1. Compute `(path, change_type)` where `change_type ∈ {create, modify, delete}`.
2. Look up the classification matrix → list of Diátaxis artifacts that *should* exist for this change.
3. For each required artifact, check existence + freshness:
   - **JSDoc inline:** each `export` in the changed file has a JSDoc block containing `@example` OR `@remarks`. Coverage = (annotated / total exported symbols).
   - **README per BC:** `apps/api/src/contexts/<bc>/README.md` or `apps/web/src/features/<feature>/README.md` exists.
   - **ADR:** `docs/decisions/ADR-NNN-*.md` exists if the change introduces a new non-obvious decision (heuristic: file names matching `*.policy.ts`, `*.guard.ts`, schema additions, new env keys, new public decorator).
   - **OpenSpec spec:** if the change touches behavior, `.openspec/changes/<feature>/` is referenced in the commit.
   - **Runbook:** if the change touches `infra/`, `docker-compose.yml`, or `.env.example`, the corresponding `infra/RUNBOOK-*.md` exists or is updated.
4. Emit findings as **non-blocking inline warnings** with one-click generation buttons (the agent calls a sub-skill to fill each gap). Blocking only kicks in after N=3 consecutive "skip" responses on the same file.
5. The detector writes nothing; it only emits JSON to the agent's context.

### Mode 2 — `/documentar` audit (manual, on-demand)

Three phases:

1. **Scan** — full-repo walk over `apps/`, `packages/`, `docs/`, `.openspec/`, `infra/`. Produces `docs/audit/<YYYY-MM-DD>-doc-coverage.md` with three tables:
   - JSDoc coverage % per file (green ≥ 80%, yellow 50–80%, red < 50%).
   - Expected artifacts × existing artifacts (READMEs per BC, ADRs per flagged decision, runbooks per service).
   - ADR cross-reference integrity: every `@see ADR-NNN` or `See ADR-NNN` in JSDoc or specs resolves to an existing file.
2. **Plan** — prioritized list of gaps, each with: target path, template to use, source-snippet that needs documenting, estimated effort.
3. **Fill** — optional. Spawns one sub-agent per gap group (e.g. one per bounded context), each writing files in parallel. `--dry-run` shows diffs without writing. `--module=<path>` scopes the scan. `--type=<adr|readme|jsdoc|runbook|openspec>` scopes the artifact type.

## Classification matrix

| Path pattern | Artifact type | Diátaxis | Target location |
| --- | --- | --- | --- |
| `apps/api/src/contexts/*/domain/**/*.ts` | domain entity / VO / error | `explanation` | JSDoc `@remarks` + ADR if decision is non-obvious |
| `apps/api/src/contexts/*/application/use-cases/*.ts` | use-case | `how-to` | JSDoc `@example` (happy + error paths) |
| `apps/api/src/contexts/*/infrastructure/http/*.ts` | controller | `reference` | JSDoc + `@ApiTags` + OpenAPI summary |
| `apps/api/src/contexts/*/infrastructure/persistence/*.ts` | Prisma adapter | `reference` | JSDoc + cross-link to `schema.prisma` |
| `apps/web/src/features/*/domain/**/*.ts` | frontend BC | `explanation` | JSDoc `@remarks` |
| `apps/web/src/features/*/application/use-cases/*.ts` | frontend use-case | `how-to` | JSDoc `@example` |
| `apps/web/src/features/*/adapters/presentation/*.tsx` | form / view | `tutorial` | Component-level README section |
| `apps/web/src/app/**/page.tsx` | route | `tutorial` | Optional README; otherwise JSDoc on the page module |
| `apps/web/src/lib/**/*.ts` | shared client | `reference` | JSDoc `@example` |
| `packages/contracts/src/**/*.ts` | Zod schema | `reference` | JSDoc + auto-derived from Zod (no duplication) |
| `apps/api/prisma/schema.prisma` | DB schema | `reference` | `///` doc comments per model |
| `infra/**` | infra-as-code | `how-to` | `infra/README.md` or new `infra/RUNBOOK-*.md` |
| `.env.example` keys | env contract | `reference` | Annotated in `infra/RUNBOOK-env.md` (single source) |
| New non-obvious decision | ADR | `explanation` | `docs/decisions/ADR-NNN-<slug>.md` |

## Generation strategy

- **Template-first.** Skill ships `assets/templates/` with one template per (Diátaxis quadrant × artifact type). The structure is guaranteed; only the content is filled.
- **AI-fill.** When the skill generates, it provides the sub-agent with: the diff, neighbor files, referenced ADRs, the relevant template, and a "do not invent" instruction. Invented facts block the verification phase.
- **Idempotent.** Re-running on an already-documented file updates only empty fields; never duplicates. A pre-write diff check refuses to clobber non-empty content.
- **Single-source-of-truth.** Each fact lives in ONE canonical artifact; others link. Cross-link table:

| Canonical home | Do not duplicate in |
| --- | --- |
| JSDoc inline | BC README (link) |
| BC README | ARCHITECTURE.md (link) |
| ADR | JSDoc `@remarks` (link only) |
| OpenSpec spec | README/JSDoc (link only) |
| Runbook | Other runbooks / README (link only) |

## When the skill explicitly does NOT generate

- `*.spec.ts` / `*.test.tsx` — tests are self-documenting by name.
- `index.ts` barrels — only re-exports.
- Generated output — `dist/`, `.next/`, `coverage/`, `node_modules/`.
- Vendor configs — `eslint.config.mjs`, `tailwind.config.ts`, etc., unless they encode a project-specific decision (then it goes to an ADR).

## Integration with existing harness

| Component | Change |
| --- | --- |
| `.harness/check.sh` | **New entry `INC-018-doc-coverage`** — fails the build if any `apps/api/src/contexts/*/` lacks `README.md` OR any `apps/web/src/features/*/` lacks `README.md` OR JSDoc coverage on the touched file (in the diff) is < 80% on its exported surface. |
| `.harness/detect.sh` (L2) | Reuses the same classifier; when it confirms a gap, the inline prompt becomes "doc-missing — generate now?" and offers a one-click sub-skill call. |
| `.harness/digest.py` (L3) | Adds a row to the daily digest: `N files missing reference docs`, `M stale ADR refs`. |
| `.harness/INCIDENTS.md` | New `INC-018` entry describing the rule and the auto-check. |
| `.harness/learnings.json` | New entry with `trigger_pattern` matching `(Edit|Write)` on a doc-covered path + `prevention.type = "skill"`. |
| `.openspec/AGENTS.md` | One-paragraph addition linking the skill as a sub-step of Phase 3 (docs for the design land together with `design.md`). |
| `AGENTS.md` (raiz) | One paragraph in §7 mentioning the skill. |
| Codemods | The skill **does not create codemods** — docs are not rewritten in mass. It points to the corresponding ADR if a missing-doc pattern recurs. |

## Skill structure

The skill lives at `~/.claude/skills/documentation/` (global install):

```
~/.claude/skills/documentation/
├── SKILL.md                                  # frontmatter + workflow
├── assets/
│   └── templates/
│       ├── jsdoc-reference.md                # @example + @remarks
│       ├── jsdoc-explanation.md              # ADR cross-link
│       ├── adr-nygard.md                     # ADR template
│       ├── readme-bc-api.md                  # bounded context README
│       ├── readme-bc-web.md                  # feature README
│       ├── runbook-infra.md                  # infra runbook
│       └── openspec-spec.md                  # spec delta
├── bin/
│   ├── classify.py                           # path → quadrant + target
│   ├── jsdoc-coverage.py                     # per-file JSDoc coverage
│   ├── adr-ref-check.py                      # cross-ref integrity
│   └── audit-report.py                       # scan + emit markdown
└── references/
    ├── diataxis.md                           # 4 quadrants, with examples
    ├── ai-padrao-matrix.md                   # project-specific mapping
    └── verification.md                       # post-write checks
```

## Skill workflow (SKILL.md high-level)

1. **Receive trigger** — either auto (Edit/Write tool call) or manual (`/documentar [--audit] [--module=...] [--type=...] [--fix] [--dry-run]`).
2. **Classify** — `bin/classify.py` emits a JSON plan: which artifacts need to exist for this change.
3. **Check** — for each required artifact, test existence + freshness. Emit a list of gaps.
4. **Prompt** — present gaps as inline warnings (auto mode) or as a coverage table (audit mode).
5. **Generate** — if user opts in (auto) or `--fix` is passed (manual), spawn sub-agents to fill gaps.
6. **Verify** — run `pnpm typecheck` on touched package, grep for placeholders (`TODO|FIXME|<descrever>`), check ADR cross-refs. Fail loudly if any check fails.

## Verification (post-generation, blocking)

After the skill writes docs:

1. `pnpm --filter <pkg> typecheck` — JSDoc must not break types.
2. `grep -E "TODO|FIXME|<descrever>"` on newly-written files — must return empty.
3. ADR cross-ref integrity — every `@see ADR-NNN` and `See ADR-NNN` in the new docs resolves to an existing file.
4. Link check on internal `.md` links — must not 404.

Failure in any check → revert the writes + report.

## Flags (audit mode)

- `--audit` (default for `/documentar`) — scan + report, no writes.
- `--fix` — fill gaps in parallel.
- `--module=<path>` — scope to a single module.
- `--type=<adr|readme|jsdoc|runbook|openspec|all>` (default `all`).
- `--dry-run` — show diffs without writing.
- `--stale-only` — only check cross-reference integrity.

## Acceptance criteria

For this work to ship:

1. `~/.claude/skills/documentation/` exists with the full structure above; `SKILL.md` frontmatter declares auto-trigger on Edit/Write.
2. `bin/classify.py` correctly classifies at least the 13 path patterns listed in the matrix (test fixtures under `bin/__tests__/`).
3. `bin/jsdoc-coverage.py` reports coverage for every `.ts/.tsx` file under `apps/` and `packages/` and matches manual spot-check on 3 sample files.
4. `bin/audit-report.py --audit` writes `docs/audit/<YYYY-MM-DD>-doc-coverage.md` with the three tables populated.
5. `.harness/check.sh` gains `INC-018-doc-coverage`; running `pnpm harness:check` reports it as PASS (or SKIP with documented reason).
6. `.harness/INCIDENTS.md` gains the INC-018 entry; `.harness/learnings.json` gains the corresponding record.
7. `.openspec/AGENTS.md` and `AGENTS.md` are updated with the one-paragraph mentions.
8. The audit run on this repo (current state) lands a `docs/audit/2026-08-05-doc-coverage.md` that the user reviews.

## Out of scope

- Generating content for tests (`*.spec.ts`).
- Editing `AGENTS.md` rules (the skill *reads* AGENTS.md, it does not write it).
- Creating new incidents beyond INC-018.
- Refactoring `packages/contracts` to be self-documenting from Zod metadata (deferred; tracked separately if/when needed).
- Generating prose tutorials (Diátaxis `tutorial`) — only structural ones (BC README) are in scope for v1.

## Risks

| Risk | Mitigation |
| --- | --- |
| False positives (skill flags docs that exist elsewhere) | Single-source-of-truth table in the skill; classifier honors cross-links |
| Friction blocks real work | Auto mode is non-blocking by default; only escalates after 3 consecutive skips on the same file |
| Skill adds latency to every Edit | Classifier is path-only; no file content reads unless the path matches a matrix entry |
| Generated docs are low quality | Templates enforce structure; verification phase blocks placeholders and broken refs |
| Documentation matrix drifts from reality | The matrix lives in `references/ai-padrao-matrix.md` and is updated whenever a new path pattern emerges (the digest flags mismatches) |
| Skill conflicts with the no-skipped-tests harness (INC-012) | Skill never wraps a test in `.skip`; if a doc gap blocks, it surfaces the gap, not the test |

## Spec self-review (per brainstorming skill checklist)

**Placeholder scan:** No `TBD` / `TODO` / vague requirements. Every artifact path is a concrete filename or glob. Every flag has explicit semantics.

**Internal consistency:** Section "Skill structure" matches "Integration with existing harness" — no extra files promised, no files missing. The matrix table is the same in the architecture section and in the classifier description.

**Scope check:** Single deliverable — a skill + 1 new auto-check + 4 small doc touch-ups (`.harness/check.sh`, `.harness/INCIDENTS.md`, `.harness/learnings.json`, `.openspec/AGENTS.md`, `AGENTS.md`). Fits in one PR.

**Ambiguity check:**

- "JSDoc coverage" — quantified: `annotated_exports / total_exports`, where `annotated` requires `@example` OR `@remarks`.
- "Non-obvious decision" — heuristic enumerated in the auto-sensor description (file names matching `*.policy.ts`, `*.guard.ts`, schema additions, new env keys, new public decorators).
- "Consecutive skips" — quantified as N=3 in the auto-sensor description.
- "Touched file" for INC-018 — the file appears in `git diff --name-only` of the staged changes.

No conflicts with `AGENTS.md` (the skill obeys the SDD rule; no behavior change without a proposal). No conflict with `ADR-007` (the skill never silences a test).
