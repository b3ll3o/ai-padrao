# Spec: harness — Detector Type-vs-DI Gap (INC-024)

This spec describes the behaviour of `.harness/pattern_match.py` after
the change is implemented. It only affects the **symbol axis** of the
INC-003 match; all other axes and all other INC entries are unchanged.

## Requirements

The keywords **SHALL**, **SHOULD**, and **MAY** follow RFC 2119.

### Suffix-based safe-binding classification

- THE matcher SHALL consult a project-wide positive-list of type-only
  suffixes when classifying an `import type` binding. The default list
  is: `Type`, `Interface`, `Dto`, `Context`, `Spec`, `Map`, `Key`,
  `Schema`.
- WHEN a single `import type { X, Y, Z }` statement binds only names
  whose last-segment ends in one of the registered suffixes, THE
  matcher SHALL classify the event as **`type-only-safe`** and SHALL
  NOT emit INC-003.
- WHEN any binding in an `import type` statement does NOT end in a
  registered suffix AND that binding has a leading uppercase character,
  THE matcher SHALL classify the event as **`class-di-risk`** and emit
  INC-003, exactly as today.
- WHEN the suffix-check is mixed (some bindings match, some do not),
  THE matcher SHALL run the **brace-AST** extractor (Decision 2,
  Mode B) before falling back to the current behaviour.

### Brace-AST fallback

- THE matcher SHALL extract the brace body of an `import type { … }`
  statement using a brace-balanced forward walk (handles single-line
  and multi-line statements, plus trailing commas and comments).
- WHEN every binding inside the brace body is either suffix-marked OR
  lowercase, THE matcher SHALL classify the event as `type-only-safe`.
- WHEN at least one binding has a leading uppercase character and no
  registered suffix, THE matcher SHALL classify the event as
  `class-di-risk` and emit INC-003.

### Indeterminate handling

- WHEN neither the suffix-list nor the brace-AST extractor yields a
  confident `type-only-safe` classification, THE matcher SHALL fall
  back to the current behaviour and emit INC-003 for operator review.
- WHEN an event has more than 100 bindings in a single `import type`
  statement, THE matcher SHALL classify it as `indeterminate` and fall
  back to the current behaviour (barrel-file cases are too ambiguous
  to classify cheaply).

### Configuration mirror

- THE constant `TYPE_ONLY_SUFFIXES` SHALL live in
  `.harness/pattern_match.py` as a tuple of strings (read at module
  load).
- THE same suffix-list SHALL be mirrored into
  `.harness/learnings.json` under
  `prevention_summary.by_auto_check_type.symbol_axis_classifier` for
  the daily digest pipeline and human-readable project state.
- THE INC-003 entry in `.harness/learnings.json` SHALL gain an OPTIONAL
  `trigger_pattern.symbol_filters.safe_suffixes` array; absent → old
  behaviour; present → the matcher consults the classifier.

### Reporting

- THE daily digest (`pnpm harness:digest`) SHALL record the count of
  events classified as `type-only-safe` per day, per INC entry.
- THE digest SHALL NOT emit an INC-003 row for events classified as
  `type-only-safe` (today it does, and the operator has to manually
  say "false positive").
- THE digest SHALL continue to emit INC-003 rows for events classified
  as `class-di-risk` or `indeterminate`, preserving the current
  behaviour.

### Backward compatibility

- WHEN `trigger_pattern.symbol_filters` is absent from an entry in
  `.harness/learnings.json`, THE matcher SHALL behave exactly as today
  (INC-019/020/021/022/023/024 family).
- WHEN a new entry is added WITHOUT a `trigger_pattern.symbol_filters`
  field, THE matcher SHALL still match it against INC-003's symbol
  axis exactly as today — the new field is opt-in per entry.
- THE `.harness/digest.py` reader SHALL tolerate an absent
  `symbol_filters` field and SHALL continue to render the same digest
  output it does today for entries without it.

## Examples

### Legitimate type-only import (suppressed)

```text
# apps/api/src/infra/prisma/audit/audit-context.spec.ts

import type { AuditContext } from "./audit-context";

// Before this change:
//   pattern_match emits INC-003 (false positive).
//
// After this change:
//   `AuditContext` ends with the registered suffix `Context`,
//   so the event is classified `type-only-safe` and INC-003
//   is NOT emitted.
```

### Real DI-risk import (still prompted)

```text
# apps/api/src/contexts/users/infrastructure/persistence/prisma/prisma-user.repository.ts

import type { PrismaService } from "@ai-padrao/db";

// Before / after this change:
//   `PrismaService` does NOT end with a registered suffix,
//   so the event is classified `class-di-risk` and INC-003
//   is emitted (the operator confirms the prompt and adds
//   the eslint-disable comment + a runtime import).
```

### Mixed bindings (brace-AST applied)

```text
# apps/api/src/infra/prisma/audit/audit.repository.ts

import type { AuditContext, PrismaService } from "../..";

// Before this change:
//   pattern_match sees the substring `import type` and emits
//   INC-003 (false positive on `AuditContext`).
//
// After this change:
//   The suffix-list classifies `AuditContext` as safe but
//   leaves `PrismaService` unclassified.
//   The brace-AST extractor sees one uppercase unmarked
//   binding → classifies the event as `class-di-risk` → INC-003
//   is emitted (real DI risk on `PrismaService`).
```

### Barrel file (indeterminate)

```text
# apps/api/src/common/types/index.ts (100+ bindings)

import type { /* …many names… */ } from "@ai-padrao/contracts";

// After this change:
//   The matcher classifies this as `indeterminate` (binding
//   count > 100) and falls back to today's behaviour.
//   INC-003 may be emitted; the operator confirms.
```

## Out of behavioural scope

These behaviours are intentionally unaffected:

- The file-axis gate (INC-023 scoping) is unchanged.
- INC-019, INC-020, INC-021, INC-022 detectors are unchanged.
- INC-003's `trigger_pattern.files` glob list (tightened in
  `feat/domain-audit-foundation`) is unchanged.
- The codemod `.harness/codemods/inc-003-nest-di-imports.py` is
  unchanged.
- The PostToolUse hook in `.harness/detect.sh` is unchanged
  (still exits non-zero on match; operator confirms).
