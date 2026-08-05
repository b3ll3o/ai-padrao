# Design: Detector Type-vs-DI Gap — Symbol-Axis Semantic Filter (INC-024)

Reference: `proposal.md` in this folder.

## Decisions

### Decision 1: Suffix-based positive-list over AST-heuristic

**Context:** INC-023 (already shipped) restricts the symbol-axis hit to
events that pass the file-axis gate (i.e. an edit/write on a path that
matches INC-003's `trigger_pattern.files` glob). INC-024 documents that
even with INC-023 in place, the matcher fires on a legitimate
`import type` for an interface (e.g. `AuditContext`) inside a DI-relevant
file. The gap is that the substring match doesn't ask *what* is being
imported — only *that the substring exists*.

There are two plausible fixes at this layer:

- (a) **AST-lite brace-balanced parse** — read the import line, find the
  `{ … }` brace pair, extract the binding list. Then for each binding,
  check whether the binding name matches a positive-list of type-only
  suffixes (`Type`, `Interface`, `Dto`, `Context`, `Spec`, `Map`, `Key`,
  `Schema`). Pros: still stdlib-only. Cons: still doesn't know whether a
  suffix-marked binding is actually a type.
- (b) **Project-wide import-graph walk** — for each `import type`
  binding, walk the import graph up to the source of the binding and
  classify it as `class` / `interface` / `type` via TypeScript's
  compiler API. Pros: authoritative. Cons: requires running `tsc`,
  defeats the inline-detector O(1)-per-event budget.

**Choice:** (a). INC-024's option #3 — suffix-based positive-list with
AST-lite brace extraction to keep the matcher stdlib-only and bounded
to a single event window. We accept the residual false-negative risk
(§Risks in `proposal.md`) and leave option #2 (constructor-signature
heuristic) and option #4 (TypeScript compiler API) as future, separate
changes.

**Rejected alternatives:**

- Skip this layer entirely and rely on the operator confirming every
  INC-003 prompt — INC-024 already lists this as the current
  *tradeoff accepted for now*, and it's the gap we're closing.
- Implement option #2 now — too costly for the inline detector and
  overlaps with where a CI-side lint belongs (ADR-014 follow-up).

### Decision 2: Classifier modes

**Context:** The classifier needs three outputs per event: `class-di-risk`
(triggers INC-003), `type-only-safe` (no INC-003 prompt), and
`indeterminate` (fall back to the current behaviour, i.e. prompt the
operator).

The classifier modes are:

- **Mode A — suffix positive-list.** When every binding inside the
  `import type { … }` brace pair ends in one of the registered suffixes
  (`Type`, `Interface`, `Dto`, `Context`, `Spec`, `Map`, `Key`,
  `Schema`), the event is `type-only-safe` and INC-003 is suppressed.
  The positive-list is **bound to the binding name suffix**, not to the
  file path — both legitimate and illegitimate bindings can share a
  suffix, but the heuristic gets the *common* case right.
- **Mode B — brace-AST parse.** When the suffix check yields mixed
  results (some bindings match, some don't), the matcher extracts the
  full brace body and asks: does any binding name have a leading uppercase
  character but no registered suffix? If yes, classify as
  `class-di-risk`; if all bindings either match a suffix or are
  lowercase, classify as `indeterminate`.
- **Mode C — indeterminate → prompt.** When neither A nor B yields a
  confident `type-only-safe`, fall back to today's behaviour (operator
  confirm). Each indeterminate case is a *learning sample*: the digest
  pipeline records it, and a future change can lower the threshold
  based on observed patterns.

**Choice:** Implement A → B → C in that order. A single Mode A rule
covers the documented INC-024 cases (interfaces, DTOs, AsyncLocalStorage
shapes); Mode B is the safety net for ambiguous edges; Mode C preserves
the current "confirm with user" contract for anything we don't yet
recognise.

### Decision 3: Where the suffix-list lives

**Context:** The suffix positive-list must be (1) project-wide
consistent, (2) trivially editable by humans, and (3) version-controlled
alongside the matcher code that consumes it.

**Choice:** Embed the suffix-list as a top-level constant in
`.harness/pattern_match.py` (`TYPE_ONLY_SUFFIXES = (...)`) AND mirror it
into `.harness/learnings.json` under
`prevention_summary.by_auto_check_type.symbol_axis_classifier`. This
duplication is deliberate: the matcher must work even when
`learnings.json` is being edited (the document-it-self failure mode
INC-023 was designed to fix), but the daily digest pipeline reads
`learnings.json` for its reporting columns, so the suffix list must
appear there too.

**Rejected alternatives:**

- Single source of truth in `learnings.json` — INC-024 documents the
  problem that editing `learnings.json` triggers the very pattern it
  declares. The matcher must NOT depend on JSON lookups for its
  hot-path classification.
- Single source of truth in `pattern_match.py` — fine for the matcher,
  but the daily digest would lose visibility into the configured suffix
  list. The digest wants human-readable project state, not internal
  Python constants.

### Decision 4: Schema migration of `.harness/learnings.json`

**Context:** The current INC-003 entry has a flat
`trigger_pattern: { files: [...], symbols: [...] }` shape. The new
classifier needs to attach a per-symbol filter without breaking the
existing reader in `.harness/digest.py`.

**Choice:** Add an OPTIONAL `symbol_filters` field under each entry's
`trigger_pattern`. Absent → old behaviour (current behaviour). Present
→ matcher consults the classifier before emitting. The schema stays
additive; downstream readers that don't know `symbol_filters` keep
working because they only read `trigger_pattern.files` and
`trigger_pattern.symbols`.

```jsonc
{
  "id": "INC-003",
  "trigger_pattern": {
    "files": [ /* tightened globs from feat/domain-audit-foundation */ ],
    "symbols": ["import type"],
    "symbol_filters": {
      "safe_suffixes": ["Type", "Interface", "Dto", "Context", "Spec",
                        "Map", "Key", "Schema"],
      "indeterminate_fallback": "prompt"
    }
  }
}
```

**Rejected alternatives:**

- Bump the schema version and break readers — INC-003 is on the
  hot-path of every deploy; a forced reader upgrade is unjustified.
- Move the suffix-list under a separate `classifier_policy` field —
  ok, but adds another key without saving anything. `symbol_filters`
  nests naturally under `trigger_pattern` and signals intent ("this
  filter attaches to the symbol axis").

### Decision 5: When to re-prompt vs. suppress

**Context:** The detector's whole purpose is to *prompt the operator*
when a known anti-pattern re-appears (per CLAUDE.md §4 + ADR-006/007).
Suppressing INC-003 for type-only `import` shrinks the prompt surface,
which reduces signal — but it also reduces false-positive noise, which
is exactly the gap INC-024 documents.

**Choice:** Keep the prompt but split it into two flavours:

- **`INC-003` (class-di-risk)** — keep as-is. The `eslint-disable
  @typescript-eslint/consistent-type-imports` comment-or-conventional
  fix loop continues.
- **`INC-024` (type-only-safe-no-op)** — silent. No prompt, no log
  noise. The digest records the count for trend visibility.

This way, every legitimate `import type` for an interface is
*correctly* classified as safe — neither prompting the operator nor
emitting a digest entry that says "INC-003 fired" (today it does, and
the operator has to manually say "false positive" each time).

**Rejected alternatives:**

- Always prompt, even for safe cases — current behaviour, leaves the
  gap unaddressed.
- Always suppress — defeats the purpose of the detector; misses real
  class-DI regressions.

## Open questions

- **Q1.** Should the suffix-list be project-wide (every Nest project
  on Earth uses these suffixes?) or per-context? *Initial decision:*
  project-wide, in `.harness/pattern_match.py`. If a future context
  needs different suffixes, the file becomes the right override point
  (one constant, one git grep).
- **Q2.** Does the AST-lite brace extractor handle multi-line
  `import type` statements (binding list wraps to the next line)?
  *Initial decision:* yes — line-continuation handling is part of the
  brace-balancer (`{}` depth counter walks forward through the line).
  Unit test `test_import_type_multiline_brace_extraction` proves it.
- **Q3.** Should we cap the binding list at N (e.g. 8)? *Initial
  decision:* no — INC-019/020/021/022/023 all assume ≤ 20-events; an
  individual event is bounded by TypeScript's own import-limit
  warnings; if a single import has >100 bindings it's almost certainly
  a barrel file and the matcher should treat the whole event as
  `indeterminate` (which preserves the prior behaviour).
