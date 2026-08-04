---
title: Project Documentation Audit & Refresh
date: 2026-08-04
status: approved (brainstorming exit)
scope: documentation-only (no SDD proposal required per AGENTS.md)
---

# Project Documentation Audit & Refresh — Design

## Goal

Bring the project's documentation set into a consistent, accurate, useful state by:

1. Replacing the stale `CLAUDE.md` (which still claims the project is freshly initialized) with a Claude-Code-oriented index of the actual rules and architecture.
2. Reconciling incident-count inconsistencies across `README.md` and `.harness/README.md` (currently 12, should reflect the actual 16).
3. Capturing the most actionable project-specific decisions as Architecture Decision Records under `docs/decisions/` (Nygard-style, one file per ADR).
4. Adding two new top-level documents: `CONTRIBUTING.md` (PR workflow) and `ARCHITECTURE.md` (the big picture).

## Background / Audit findings

Audit performed by reading the documentation as an outside observer would. Findings:

| File                                                              | State      | Issue                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLAUDE.md` (27 lines)                                            | **Stale**  | Says "freshly initialized", "the only tracked file is `README.md`", and lists future-only TODOs as if the project were empty. The TODO list at the bottom is a checklist of sections to fill in once code lands — code has long since landed.                                                                                                                                  |
| `README.md` (156 lines)                                           | Mixed      | Mostly current post-stabilization. Inconsistent incident counts: line 116 says "All 12 incidents" in the policies section, line 152 says "the 12 incidents" in Further Reading, but the Self-improving harness section says "16 entries to date" (line 91) and "16 PASS / 0 FAIL / 3 SKIP" (line 97). The 16 is correct; the 12s are left over from a pre-stabilization count. |
| `.harness/README.md` (95 lines)                                   | **Stale**  | Current state table (lines 53-61) reads 12 incidents / 11 with skill prevention / 10 of 12 auto-check / 8 distinct categories. Coverage map (lines 62-78) only covers INC-001 to INC-012 — INC-013 through INC-016 are not represented. Line 80 summary still says "12 incidents" and "10 of 12".                                                                              |
| `AGENTS.md` (199 lines)                                           | Current    | Aligns with the post-stabilization state. References INC-012..INC-016 in the Continuous learning section.                                                                                                                                                                                                                                                                      |
| `.openspec/AGENTS.md` (121 lines)                                 | Current    | OpenSpec workflow well-documented; matches the templates in `.openspec/templates/`.                                                                                                                                                                                                                                                                                            |
| `.harness/INCIDENTS.md` (~518 lines)                              | Current    | 16 incidents logged (INC-001 through INC-016). Format consistent.                                                                                                                                                                                                                                                                                                              |
| `docs/superpowers/specs/2026-08-04-ai-padrao-blueprint-design.md` | Historical | Original blueprint design spec. Keep as-is for traceability.                                                                                                                                                                                                                                                                                                                   |
| `docs/superpowers/plans/2026-08-04-ai-padrao-blueprint.md`        | Historical | Original blueprint implementation plan. Keep as-is.                                                                                                                                                                                                                                                                                                                            |

`.harness/check.sh` itself contains 14 named auto-checks: INC-001, 002, 004, 005, 006, 007, 008, 009, 011, 012, 013, 014, 015, 016. The remaining two are manual: INC-003 (`import type` in DI'd services — a known TypeScript ESLint footgun, documented but not auto-enforced) and INC-010 (Swagger 8 + Nest 11 peer warning — docs-only, no auto-check possible). The README's "3 SKIP" claim is itself inaccurate by one — actually 2 manual. Both numbers will be verified at implementation time by running `pnpm harness:check`.

## Approach (chosen: option C)

Three deliverables clusters:

1. **In-place fixes** to existing files (4 files, mostly surgical).
2. **Architecture Decision Records** in `docs/decisions/` (11 new files, one per ADR).
3. **Two new top-level docs**: `CONTRIBUTING.md` and `ARCHITECTURE.md`.

The choice among brainstormed options was C (audit + new docs) because the user's stated requirement was "crie e atualize a documentação", which leans toward inclusive coverage rather than minimal patch. Risks of C (scope creep, doc drift) are mitigated by linking rather than duplicating.

## Deliverables

### Cluster A — In-place fixes to existing files

#### A1. `CLAUDE.md` — full rewrite

**From:** 27 lines, "freshly initialized" placeholder content.

**To:** ~150 lines across 7 sections:

1. **Project snapshot** — stack, monorepo layout, port policy, editor.
2. **Common commands** — quick reference (full list in AGENTS.md).
3. **High-level architecture** — apps, packages, request flow, JWT flow, observability.
4. **Conventions unique to this repo** — SDD mandatory via OpenSpec, zero skipped tests, no Prisma in apps/web, file-ordering precedence (AGENTS.md > CLAUDE.md).
5. **Editor / AI-assistant config** — VSCode workspace settings, AGENTS.md as single source of truth across AI providers, .openspec/AGENTS.md for OpenSpec.
6. **Project-specific ADRs (index)** — 11 links into `docs/decisions/` with a one-sentence "When you encounter X, do Y" for each.
7. **What is NOT covered here** — links to .openspec/AGENTS.md, .harness/README.md, .harness/INCIDENTS.md, AGENTS.md.

**Style:** factual, no flourishes. No code examples in body (link to docs/decisions for that). The four "Future CLAUDE.md sections" listed in the current file are precisely the four content sections above (Snapshot, Commands, Architecture, Conventions) — the new file fulfils the original placeholder promise.

#### A2. `README.md` — 3-4 surgical fixes

| Line | Before                                            | After                                                                                                  |
| ---- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 116  | "All 12 incidents have prevention rules"          | "All 16 incidents have prevention rules"                                                               |
| 152  | "the 12 incidents that shaped the policies above" | "the 16 incidents that shaped the policies above"                                                      |
| 97   | "16 PASS / 0 FAIL / 3 SKIP (manual)"              | Verified count after running `pnpm harness:check`. Suspected correct value: 14 PASS / 0 FAIL / 2 SKIP. |

If the suspected values are wrong at runtime, use the actual numbers.

#### A3. `.harness/README.md` — table rebuild

- "Current state (as of 2026-08-04)" table: every "12" → "16"; every "10/12" → actual X/16; "8 distinct" → actual; add a "Last refresh" row showing the most recent `.harness/digest/*.md` mtime.
- "Coverage map" table: extend with INC-010, INC-011, INC-012, INC-013, INC-014, INC-015, INC-016 (each with its prevention layer and auto-check).
- Line 80 summary "All 12 incidents" → "All 16 incidents" + percentage recomputed.

The "Date" header in the table advances from "as of 2026-08-04" to reflect the actual write date.

### Cluster B — `docs/decisions/` (Nygard-style ADRs)

11 ADR files, each ~30-50 lines:

```
docs/decisions/
├── README.md                        # index, "How to read these"
├── ADR-001-fastify-reply-api.md
├── ADR-002-no-import-type-for-nest-di.md
├── ADR-003-public-decorator-on-health-auth.md
├── ADR-004-dockerfile-copy-schema-before-generate.md
├── ADR-005-non-default-ports.md
├── ADR-006-nest-logger-not-console.md
├── ADR-007-no-skipped-tests.md
├── ADR-008-capture-scripts-bash-and-python3-only.md
├── ADR-009-events-directory-is-gitignored.md
├── ADR-010-daily-digest-freshness.md
└── ADR-011-no-plaintext-secrets-in-source.md
```

Each ADR has the canonical Nygard structure:

```
# ADR-NNN — Title (short noun-phrase)

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-XXX (full context in .harness/INCIDENTS.md)

## Context
(2-3 sentences on what happened, who was affected, what the constraint was)

## Decision
(Rule stated unambiguously — what we will do, why the alternative was rejected)

## Consequences
(What becomes easier, what becomes harder, what we trade off)

## Enforcement
(Auto-check that catches the rule violation, and where the skill/rule lives.)
```

`README.md` at the top of `docs/decisions/` is a one-page index with: how to read these, the 11 ADRs in chronological order, and a one-line "If you're an AI assistant, the three most-fired ADRs are: 002, 006, 007" commentary.

### Cluster C — Two new top-level docs

#### C1. `CONTRIBUTING.md` (raiz, ~120-150 lines)

Sections:

1. **Code of conduct** — one paragraph (be kind; technical critique welcome).
2. **Development setup** — prerequisites (Node 22+, pnpm 9, Docker, corepack), quickstart, verify (pnpm harness:check + pnpm test + pnpm lint + pnpm typecheck).
3. **Workflow: SDD is mandatory** — link to .openspec/AGENTS.md; "open a proposal before writing code".
4. **Conventional Commits** — format reference, allowed scopes (api, web, db, contracts, ui, config, sdd, harness, root), pre-commit hooks, when `--no-verify` is acceptable.
5. **PR checklist** — 8-10 items including harness auto-checks green, no skipped tests, no committed `.harness/events/`, no plaintext tokens, ADR linked if architecture changes.
6. **Adding a new INC** — where to log it, how to update `learnings.json`, when to add a codemod.
7. **Where decisions live** — short list mapping each directory to its content (docs/decisions, .harness/INCIDENTS.md, .openspec/specs, AGENTS.md, CLAUDE.md).
8. **Reporting issues** — bug template, security disclosure policy (don't open public issue for security — see INC-016 + ADR-011).

#### C2. `ARCHITECTURE.md` (raiz, ~120-150 lines)

Sections:

1. **High-level diagram** — ASCII or Mermaid (5 services: postgres, api, web, mailhog, otel-collector; 5 packages: db, contracts, ui, config-eslint, config-tsconfig; web→api via fetch; api→postgres via Prisma).
2. **Apps** — apps/api (NestJS 11 + Fastify) and apps/web (Next.js 15 App Router), each with stack, purpose, entry point.
3. **Packages** — short paragraph per package (db, contracts, ui, config-*).
4. **Request flow** — Web server action → fetch → @ai-padrao/contracts Zod parse → Nest controller → service → Prisma → Postgres. Plus auth flow: JWT access (15m, in-memory) + httpOnly refresh cookie, rotation on use. Plus observability: OTel SDK to OTLP collector.
5. **Persistence** — Postgres 16, migrations via Prisma Migrate, seed (admin@ai-padrao.local / admin123), Prisma access restricted to apps/api.
6. **Self-improving harness** — pointer to .harness/README.md + the 11 ADRs that govern it.
7. **Confluence with the stack** — short "why we picked this" for: pnpm + Turborepo, Nest + Fastify, Prisma, Next 15, Zod via @ai-padrao/contracts, shadcn/ui.

## Acceptance criteria

For the changes to ship:

1. `pnpm harness:check` continues to show 14 PASS / 0 FAIL / 2 SKIP (or whatever the current verified count is after the count-fix cluster lands) — documentation work must not break harness auto-checks.
2. No file outside the listed scope (CLAUDE.md, README.md, .harness/README.md, docs/decisions/, CONTRIBUTING.md, ARCHITECTURE.md) is modified.
3. No source code or non-doc infrastructure changes (no Docker, no OpenSpec template, no AGENTS.md, no .harness/check.sh).
4. Every claim of the form "X / Y" or "N incidents" in the modified files matches the verified runtime state (run the harness check, count the incidents).
5. Every new ADR file has Status: Accepted, Date 2026-08-04, Incident reference INC-XXX, and the four named sections (Context, Decision, Consequences, Enforcement).
6. `docs/decisions/README.md` lists all 11 ADRs with one-line summaries.
7. `CONTRIBUTING.md` and `ARCHITECTURE.md` link, don't duplicate: the rules they surface must live in AGENTS.md / .openspec/AGENTS.md / .harness/README.md; the new docs are orientation guides.

## Out of scope

The following are explicitly NOT part of this work:

- Changing `AGENTS.md` or `.openspec/AGENTS.md` (they are the source of truth — if they conflict with documentation, they win).
- Changing `.harness/check.sh` (auto-check implementation).
- Adding new incidents to `.harness/INCIDENTS.md`.
- Changing CI configuration.
- Any code change in `apps/`, `packages/`, `infra/`, `docker-compose.yml`.
- New features documented but not present in the codebase (the docs reflect current state, not aspirations).

## Risks

| Risk                                                         | Mitigation                                                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Inconsistency between docs (CLAUDE.md contradicts AGENTS.md) | Hard precedence rule: AGENTS.md > CLAUDE.md > CONTRIBUTING.md for rules; if any conflict surfaces, file an issue |
| Doc-drift over time                                          | New docs link to the source-of-truth (AGENTS.md, INCIDENTS.md, learnings.json), not duplicate                    |
| ADR format drift                                             | Each ADR uses the exact Nygard template; docs/decisions/README.md defines the schema                             |
| "16 PASS / 0 FAIL / 3 SKIP" was wrong (suspect "14 / 0 / 2") | Implementation phase runs `pnpm harness:check` and uses the verified number                                      |
| User wants more (or fewer) ADRs after seeing them            | Spec self-review will list all 11 explicitly; user reviews before implementation begins                          |

## Spec self-review

Per the brainstorming skill checklist, this section does an inline check after writing.

**Placeholder scan:** No "TBD" / "TODO" / vague requirements. Each deliverable cluster has a defined scope. Cross-references are precise (filename:line where useful).

**Internal consistency:** Section 1 (CLAUDE.md) lists 7 sections with no overlap among them — Snapshot (facts), Commands (recipes), Architecture (relationship), Conventions (rules), Editor/AI-config (tooling), ADRs (decisions), What-not-here (links). The ADRs are external to CLAUDE.md and pointed to.

**Scope check:** Six deliverables (CLAUDE.md rewrite, README.md fixes, .harness/README.md fixes, docs/decisions/, CONTRIBUTING.md, ARCHITECTURE.md). Each is a self-contained doc-edits PR. The work can be split into multiple commits if needed.

**Ambiguity check:**

- "Architecture Decision Records" — defined by Nygard format reference, 4 named sections, one-line status/date/incident header.
- "Subject to verification at implementation time" — explicit; the implementation plan step is to run `pnpm harness:check` and use its output.
- "Style: factual, no flourishes" — quantified as "no code examples in body; link to docs/decisions for that".

The original 4-line TODO at the bottom of the existing CLAUDE.md is now redundant — the 4 sections it foreshadows (Common commands, High-level architecture, Conventions unique, Editor/AI-assistant config) are all present in the new file. No remnant of the placeholder remains.

No conflicts with AGENTS.md detected. The new CLAUDE.md makes the AGENTS.md > CLAUDE.md precedence explicit in section 4 ("Authoritative rules: AGENTS.md").
