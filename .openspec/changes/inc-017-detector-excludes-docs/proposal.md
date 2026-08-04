# Proposal: INC-017 — Harness detector excludes documentation paths from file-axis match

**Author:** CEO Agent (Claude session caf92f62)
**Date:** 2026-08-04
**Status:** Draft (awaiting human approval per AGENTS.md §SDD is MANDATORY)

## Why

The L2 inline pattern detector (`.harness/pattern_match.py`) computes a file-axis hit when an event's combined text contains the substring `apps/api/src` (case-insensitive glob `apps/api/src/.*.*\.ts`). This axis was designed to detect when an agent is **editing runtime source code** that matches INC-002 or INC-003 — Nest+Fastify response wrappers, or NestJS DI class references.

The detector's `_event_text()` flattens seven event fields into one searchable blob, including the full JSON of `tool_input`. For a `Write` tool call, `tool_input` carries the entire markdown body of the file being written. For a `Bash` call, `tool_input` carries the literal command string.

**Observed false-positive class (today, 2026-08-04):**

When writing the Nygard-format ADRs under `docs/decisions/` that document INC-002 and INC-003 (the very patterns the detector enforces), the Write events stream into the JSONL window. Their bodies necessarily quote the trigger symbols to explain the rule. The detector then counts those bodies as "two events touch the source-path glob" (file-axis hit) and finds the matching symbol (axis hit) — and fires INC-002/INC-003 even though no runtime code was touched.

The same class will recur every time anyone documents, audits, or audits-the-auditor the harness. The detector is a **closed feedback loop** that learns from every event, and a detector that cannot tolerate documenting itself is a detector that blocks its own evolution.

The fix is the smallest possible change to the detector: **exclude documentation paths from the file-axis count**. The symbol-axis is unchanged. The fix does not weaken any INC rule against actual code violations — it only stops prose about the rule from being mistaken for code violating the rule.

## What changes

- `.harness/pattern_match.py` gains a `SOURCE_PATH_PATTERNS` allowlist (regexes anchored on `^docs/`, `^.harness/INCIDENTS\.md$`, `^.harness/learnings\.json$`, plus the diagnostic bash-command allowlist). Events whose `file_path` falls **outside** the existing INC `trigger_pattern.files` allowlist and **inside** the new documentation exclude list are skipped for the file-axis computation only; their text still contributes to the symbol-axis combined blob.
- `.harness/learnings.json` gains a 17th entry (id `INC-017`, category `detector-design`, root cause: "L2 detector cannot distinguish prose that documents a pattern from source code that violates the pattern"), with `trigger_pattern.files` deliberately empty (so this is a _meta-rule_ — about the detector, not about user code).
- `.harness/INCIDENTS.md` gains an `## INC-017` section following the same format as INC-001..016.
- `.harness/check.sh` gains an INC-017 check that asserts `SOURCE_PATH_PATTERNS` is present in `pattern_match.py` and that the regex for the docs prefix is compiled.
- `.harness/test_pattern_match.py` (new file, stdlib-only `unittest`) covers three regression cases: (a) docs-only window produces no match, (b) code-only window still matches as before, (c) mixed window produces the code-side match and ignores the docs-side.
- `.commitlintrc.json` is unchanged — the commit for the fix uses scope `harness` (already allowlisted).

## Impact

### Users (AI agents + humans)

- **Positive:** Agents can write `docs/decisions/ADR-NNN-*.md`, edit `.harness/INCIDENTS.md`, or update `.harness/learnings.json` without the detector firing on the prose they wrote. Same for read-only diagnostic bash that grep's the docs.
- **Negative:** None for the user-facing experience. The detector still catches INC-002/INC-003 (and all other INCs) against actual source code.
- **Behavior change:** "If you edit prose that mentions a trigger symbol, you used to be blocked; you will not be anymore." This is a reduction in false-positive blocks, not a relaxation of any code rule.

### System

- New runtime component: `SOURCE_PATH_PATTERNS` regex list in `pattern_match.py`. Compile-time cost is negligible (regexes are evaluated once per `main()` call).
- New file: `.harness/test_pattern_match.py` (a Python unit test that the harness check INC-017 invokes).
- New line in `.harness/check.sh` for the INC-017 assertion.
- No new top-level binary dependency. python3 only (compliant with INC-013).

### Other features

- The four layers (L1 Capture → L2 Inline detect → L3 Daily digest → L4 Enforce) are unchanged. Only L2's internal computation is refined.
- AGENTS.md does not need updating — the user-facing rule ("don't bypass the detector without acknowledging") is unchanged; what changes is the false-positive rate.
- `docs/superpowers/specs/2026-08-04-project-documentation-audit-design.md` (the design spec for the current documentation audit) does not need updating — it already noted this risk class implicitly when it said "scope creep and doc drift are mitigated by linking rather than duplicating". This fix is the detector's side of the same mitigation.

## Out of scope

- Changing the INC-002 or INC-003 `trigger_pattern` themselves. Their semantics are still correct for code violations.
- Changing the symbols axis of any INC. Only the file axis is being refined.
- Adding path-excludes for `packages/` or `apps/` — those are runtime source and the detector MUST continue to match there.
- Building a general "is this code or prose" classifier. The fix is the simplest possible path-prefix filter, scoped narrowly to the documentation paths where the false-positive class has been observed.
- Touching the L1 Capture layer, the L3 Digest layer, or the L4 Enforce layer beyond adding the INC-017 entry and check.

## Risks

| Risk                                                                                                                                                                                                | Mitigation                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Over-exclusion masks a real violation: a markdown file under `apps/api/src/main.ts.md` (hypothetical) would be excluded.                                                                            | The path filter is anchored on `^docs/` (top-level only) and two specific filenames under `.harness/`. Files like `apps/api/src/**/*.md` are NOT excluded. The regexes are explicit, not heuristic.                                              |
| The exclude list grows indefinitely as new docs directories appear.                                                                                                                                 | The change ships with a unit test that fails if any `Write` event under `apps/` or `packages/` is accidentally excluded. Future docs additions are visible in code review.                                                                       |
| Future agents think the detector is "broken" because it didn't fire on their docs work.                                                                                                             | AGENTS.md §"When the inline detector fires" already says the detector is a guide, not a wall; this fix just makes the guide quieter when it's clear the context is documentation.                                                                |
| The symbol-axis still fires on prose that contains the symbol string (e.g., "don't use `res.setHeader`" in a README would still trip INC-002 via the symbol axis if two docs events both quote it). | The file-axis is the gate. With the docs exclude, only **code** events count toward MIN_HITS=2. The symbol axis requires the file axis to pass first. So prose-only windows never fire even if they quote the symbol. This is the design intent. |
| Test file is added without a corresponding `pnpm harness:test` integration.                                                                                                                         | Task 4 of the implementation plan adds the test invocation to `.harness/check.sh` so CI runs it.                                                                                                                                                 |
