# ADR-018 — Documentation coverage is a build-time concern (`documentation` skill)

- **Status:** Accepted
- **Date:** 2026-08-05
- **Incident reference:** INC-028 — see `.harness/INCIDENTS.md` (note: INC-027 is the cyclomatic-complexity check; this entry uses the next free number)

## Context

The `ai-padrao` project invested heavily in a self-improving harness (capture → detect → digest → auto-check), but documentation coverage is enforced **only by convention**: every fact must live somewhere, but the harness has no signal for "this export lacks JSDoc", "this bounded context has no README", or "this ADR reference is broken". The 2026-08-04 audit fixed the current doc drift in one shot, but without a continuing mechanism the same drift will reappear within a sprint. The existing `AGENTS.md` rule that "documentation fixes don't require SDD" makes the gap easy to forget: there is no `auto-check` equivalent of INC-012 (no skipped tests) for the doc surface.

## Decision

We adopt the **`documentation` skill** (`~/.claude/skills/documentation/`) as the canonical sensor + classifier + generator for documentation gaps. Every change to `apps/`, `packages/`, `docs/`, `.openspec/`, or `infra/` is classified into a **Diátaxis** quadrant (tutorial / how-to / reference / explanation) and the skill emits a non-blocking warning when the corresponding artifact (JSDoc, ADR, BC README, runbook, OpenSpec spec) is missing or stale. A new `INC-028-doc-coverage` entry in `.harness/check.sh` (the next free number; INC-027 is the cyclomatic-complexity check) fails the build when a touched file drops below 80% JSDoc coverage on its public surface, when a bounded context or feature folder lacks a `README.md`, or when an ADR cross-reference cannot be resolved.

## Consequences

**Easier:**
- New contributors get inline guidance about *where* the doc for a given change lives, instead of having to discover it.
- Doc drift becomes a build-time failure, not a quarterly-audit surprise.
- The `/documentar` audit mode produces a prioritized gap list that the team can chew through in waves.
- ADR cross-refs stop rotting (broken refs fail the build).

**Harder:**
- Every PR must touch either the code or the docs that go with it — the previous "code only" workflow is no longer compliant.
- A small amount of path-pattern maintenance: when a new code path emerges (e.g. a new `apps/api/src/contexts/<bc>/infrastructure/queue/`), the classifier matrix must be updated.
- Auto-trigger emits one extra inline warning per Edit, which can feel noisy on the first session; the warning is non-blocking by default.

**Trade-off:**
- Documentation is now a `guia` (feedforward layer) of the harness, parallel to codemods and lint rules — but expressed as a *skill* (a documentation process), not a *codemod* (a rewrite) and not a *lint rule* (a hard block on a regex). We chose this middle layer because doc gaps are judgment calls that cannot be reduced to a regex without producing false positives, but must be surfaced at the moment of writing.

## Enforcement

- **Skill (sensor + classifier + generator):** `~/.claude/skills/documentation/SKILL.md`. Auto-fires on Edit / Write to covered paths; manual mode via `/documentar [--audit|--fix] [--module=<path>] [--type=<art>] [--dry-run]`.
- **Auto-check:** `.harness/check.sh` entry `INC-028-doc-coverage` (added 2026-08-05). Runs three sub-checks:
  1. BC README presence — every `apps/api/src/contexts/<bc>/` and `apps/web/src/features/<feature>/` must contain `README.md`.
  2. JSDoc coverage — for each `.ts/.tsx` file touched in the staged diff, the public-surface coverage (`bin/jsdoc-coverage.py`) must be ≥ 80%.
  3. ADR cross-ref integrity — every `ADR-NNN` reference must resolve (`bin/adr-ref-check.py`).
- **Single-source-of-truth rule:** documented in the skill (`SKILL.md` §"Single-Source-of-Truth Rule"). Each fact lives in one canonical artifact; everywhere else only links. No auto-check for v1 — review responsibility.
- **Cross-link in AGENTS.md §7** added 2026-08-05; the skill appears as a sub-step of OpenSpec Phase 3 in `.openspec/AGENTS.md`.
