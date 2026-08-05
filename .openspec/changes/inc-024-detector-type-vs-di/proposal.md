# Proposal: Detector Type-vs-DI Gap — Symbol-Axis Semantic Filter (INC-024)

**Author:** Claude (acting on the user's 2026-08-05 decision)
**Date:** 2026-08-05
**Status:** Draft

## Why

The L2 inline detector (`.harness/pattern_match.py`) still emits a soft
INC-003 prompt for legitimate `import type` usages in `apps/api/src/**`
when those usages reference a *type* or *interface* (e.g. `AuditContext`,
`AsyncLocalStorage` shapes) rather than a *class* used in NestJS
constructor-based DI. This is the exact gap documented in
[`.harness/INCIDENTS.md`](../../.harness/INCIDENTS.md) §INC-024.

INC-023 (scoped symbol-axis) already restricts the symbol axis to events
that pass the file-axis gate, but it does not filter by *file semantics*
or *binding semantics*. INC-003 then fires on any `import type`
substring inside a write/edit whose path matches the (also tightened, by
the domain-audit-foundation change) `trigger_pattern.files` globs.

The user asked on 2026-08-05: *"Abrir INC para o gap do detector."* —
i.e. promote the INC-024 documentation into an actual change with a
chosen fix from the four listed in the INC entry.

## What changes

- **New rule in INC-019/020/021/022/023/024 family:** a *semantic*
  filter on the symbol axis that excludes `import type` bindings when
  the imported binding is a known *type/interface* marker (suffix
  `Type`, `Interface`, `Dto`, `*Context`, `*Spec`, `Map`, `Key`, etc.)
  OR the imported path resolves to a `.d.ts`-only re-export.
- **Update `.harness/pattern_match.py`** so the symbol-axis check
  classifies each match as `class-di-risk` vs `type-only-safe` using
  the binding-name suffix heuristic first, then falls back to a cheap
  AST-lite parse (brace-balanced check that `import type { ... }` only
  contains identifiers matching the positive-list) for ambiguous cases.
- **New unit tests** in `test_pattern_match.py`:
  - `test_import_type_interface_binding_not_inc003`
  - `test_import_type_class_binding_still_inc003`
  - `test_mixed_window_one_interface_one_class_only_class_triggers`
  - `test_dts_only_reexport_not_inc003`
- **Update `.harness/INCIDENTS.md`** §INC-024 to record the chosen
  fix (#3 from the four listed alternatives) and link to this change.
- **Update `.harness/learnings.json`** `INC-003` entry with new
  `trigger_pattern.symbol_filters.safe_suffixes` array and policy key.
- **`prevention_summary.by_auto_check_type.manual_review`** moves
  `INC-024` from there to `grep_audit` once the gate is tight.

## Impact

### Users

- Agents authoring Nest DI providers continue to see INC-003 prompts
  when an `import type` is used for a class — the safety property is
  unchanged.
- Agents using `import type` for pure types/interfaces see no INC-003
  prompt, even when the file is in a DI-relevant directory.
- The detector stays a soft-warning layer (per `detect.sh`); the
  codemod `INC-003` keeps its `--check` / `--apply` semantics.

### System

- One new policy key (`detector-type-binding-classifier`) and one new
  auto-check type (`symbol_axis_classifier`) under
  `prevention_summary`.
- One new file-mod to `.harness/pattern_match.py`; one new
  `prevention_summary` field under each affected entry.
- No new top-level deps. The classifier uses stdlib only (re + ast).

### Other features

- `.harness/digest.py` (L3): unaffected; the daily digest already
  includes INC-024 entries from `by_auto_check_type.manual_review`,
  and they will move to `grep_audit` after this change lands.
- `.harness/check.sh` (L4): unaffected; check.sh reads from
  `learnings.json` and runs auto-checks.
- `.harness/codemods/inc-003-nest-di-imports.py`: unchanged; the
  codemod already does the safe-form rewrite.

## Out of scope

- **Fix #1** (glob tightening to `*.spec.ts`) — already shipped in
  `feat/domain-audit-foundation`; INC-024 still references it for
  historical context only.
- **Fix #2** (constructor-signature heuristic) — deferred per INC-024.
  Requires file-class parsing beyond this change's scope. A separate
  `inc-024-constructor-signature-scope` change can be opened once the
  suffix-heuristic lands and we have data on its false-negative rate.
- **Fix #4** (TypeScript compiler API) — out of scope for the
  inline detector (would require running `tsc` per event). A CI-side
  lint rule remains the right home for that; see ADR-014.
- **Per-team override files** (`.harness/learnings.local.json`) — the
  classifier uses project-wide positive/negative lists; team-specific
  waivers are a separate concern.

## Risks

| Risk                                                                                       | Mitigation                                                                                                                                       |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Suffix heuristic yields false negatives (real DI class named `UserType`).                  | The classifier falls back to a brace-balanced AST-lite parse that flags any `import type` binding used as a constructor parameter (best-effort). |
| Suffix heuristic yields false positives (interface named `UserMap` actually DI'd).          | False positive is the prior state (before INC-019's tightening); failing safe is acceptable. Operator confirms each prompt.                     |
| New `symbol_filters` field breaks downstream JSON readers that don't know about it.        | Field is optional in `.harness/learnings.json` schema; absent field = old behaviour. Documented in `learnings.json` comment block.                |
| The new classifier slows down the inline detector perceptibly.                              | The classifier runs on ≤ 20-event windows in the matcher. Heuristic is O(n) over binding names; AST-lite fallback is O(1) per brace pair.      |

## Chosen approach (from INC-024's four alternatives)

INC-024 listed four candidate fixes for this gap:

1. ❌ Tighten `files` glob to exclude `*.spec.ts` — *already shipped*
   under `feat/domain-audit-foundation`. Helped but didn't finish the
   job (real `*.ts` files still trip INC-003 for type-only imports).
2. ❌ Symbol-axis scope by file category (constructor-signature
   heuristic) — *deferred* (see Out of scope).
3. ✅ **Symbol-axis scope by binding-name suffix** (chosen) —
   `Type`, `Interface`, `Dto`, `Context`, `Spec`, `Map`, `Key`,
   `Schema` are treated as type-only and excluded from INC-003.
   Cheap, stdlib-only, testable in isolation.
4. ❌ Adopt TypeScript compiler API — *out of scope* for inline
   detector; belongs in CI lint.

→ Decision (2026-08-05): ship #3 now; #2 and #4 remain deferred and
remain on the INC-024 "Possible fixes" list with a link to this change.
