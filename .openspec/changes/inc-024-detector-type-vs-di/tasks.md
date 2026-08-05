# Tasks: Detector Type-vs-DI Gap (INC-024)

Reference: `proposal.md` in this folder.

> **Note (per CLAUDE.md §7):** Do not start any task until the
> `proposal.md` is **Approved** by the user. Tasks below are ordered —
> each one's commit references its number in the body.

- [ ] 1. Add `TYPE_ONLY_SUFFIXES` constant and `classify_import_type_binding()` helper to `.harness/pattern_match.py`
      DoD:
      - Module-level tuple `TYPE_ONLY_SUFFIXES = ("Type", "Interface", "Dto", "Context", "Spec", "Map", "Key", "Schema")`.
      - Pure function `classify_import_type_binding(line: str) -> Literal["class-di-risk", "type-only-safe", "indeterminate"]` that:
        - Returns `"type-only-safe"` when the line's brace body contains only suffix-marked or lowercase bindings.
        - Returns `"class-di-risk"` when the line has an uppercase binding without a registered suffix.
        - Returns `"indeterminate"` when the brace count > 100 OR the parse fails (no `{` found within the first 200 chars).
      - Helper is **stdlib-only** (`re`); no new top-level deps.
      - Existing matcher behaviour (today's INC-003 emission path) is unchanged when `classify_*` returns `"class-di-risk"` or `"indeterminate"`.
      - Two new private unit tests:
        - `test_classify_import_type_suffix_only_returns_safe`
        - `test_classify_import_type_uppercase_no_suffix_returns_risk`

- [ ] 2. Wire the helper into the symbol-axis gate in `pattern_match.main()`
      DoD:
      - After the existing symbol-axis hit on `import type`, the matcher calls `classify_import_type_binding(line)` once.
      - When the helper returns `"type-only-safe"`, the matcher suppresses the INC-003 emission **for that one event only**.
      - When the helper returns any other value, the matcher emits INC-003 exactly as today.
      - The matcher's return shape (`Match` dict with `id`, `reason`, etc.) gains an OPTIONAL `classification` key — absent = old behaviour.
      - The existing 14 `test_pattern_match.py` tests still pass.

- [ ] 3. Extend `learnings.json` with the per-entry `symbol_filters` field
      DoD:
      - INC-003's `trigger_pattern` now contains `symbol_filters: { safe_suffixes: [...], indeterminate_fallback: "prompt" }` (mirrors `TYPE_ONLY_SUFFIXES`).
      - `prevention_summary.by_auto_check_type.symbol_axis_classifier: ["INC-003"]` is added (mirror entry).
      - `prevention_summary.by_policy.detector-type-binding-classifier: ["INC-024"]` is added.
      - `INC-024` moves from `by_auto_check_type.manual_review` to `by_auto_check_type.grep_audit` (classifier is now grep-able by suffix).
      - `learnings.json` parses as JSON.

- [ ] 4. Add new unit tests for the classifier
      DoD: Four new tests in `test_pattern_match.py`, all green:
      - `test_import_type_interface_binding_not_inc003` — `AuditContext` in a real file path → 0 matches.
      - `test_import_type_class_binding_still_inc003` — `PrismaService` → 1 INC-003 match.
      - `test_mixed_window_one_interface_one_class_only_class_triggers` — `AuditContext` + `PrismaService` in mixed events → 1 INC-003 match (brace-AST flags class).
      - `test_dts_only_reexport_not_inc003` — synthetic `.d.ts` content with `import type { UserDto }` → 0 matches.
      - `test_import_type_multiline_brace_extraction` — wrapped multi-line `import type { Foo, Bar, Baz }` → correctly classified regardless of line breaks.
      - `test_barrel_over_100_bindings_indeterminate` → falls back to old behaviour; emits INC-003.

- [ ] 5. Update `.harness/INCIDENTS.md` §INC-024
      DoD:
      - The §INC-024 section's "→ Awaiting decision" line is replaced with "→ **Resolved (2026-08-05)**" pointing to this change.
      - The four candidate fixes section marks #3 as the chosen fix and adds the rationale.
      - A new "Verification" subsection documents a synthetic 20-event window containing each of the example scenarios above and the expected INC-003 emission count for each.
      - The "Related" link now points to this change's
        `proposal.md` (`../changes/inc-024-detector-type-vs-di/proposal.md`).

- [ ] 6. Update daily digest pipeline to count `type-only-safe` events
      DoD:
      - `.harness/digest.py` gains a `record_type_only_safe_count(inc_id, n)` helper.
      - `prevention_summary.daily_counts.type_only_safe` is added per INC entry.
      - The digest's per-entry row gains a `type-only-safe / day` column.
      - The existing 14+16=30 harness tests still pass.

- [ ] 7. Manual end-to-end verification
      DoD: A synthetic 20-event JSONL (representative of the historical INC-024 false positive) is piped through `.harness/pattern_match.py`:
      - Two `Write` events on `apps/api/src/infra/prisma/audit/audit-context.spec.ts` containing `import type { AuditContext }` → 0 matches.
      - Two `Write` events on `apps/api/src/contexts/users/infrastructure/persistence/prisma/prisma-user.repository.ts` containing `import type { PrismaService }` → 1 INC-003 match.
      - Two `Write` events on `apps/api/src/infra/prisma/audit/audit.repository.ts` containing `import type { AuditContext, PrismaService }` → 1 INC-003 match.
      - Two `Write` events on `apps/api/src/common/types/index.ts` containing >100 bindings in one `import type` → 1 INC-003 match (indeterminate → prompt).
      - Total: 3 INC-003 matches out of 8 file-axis hits. Verified against the historical window from `.harness/events/2026-08-05.jsonl` lines 944-963 (the original INC-024 trigger), which now produces 0 matches instead of 1.

- [ ] 8. Commit each task as a separate Conventional Commit
      DoD: 6 commits on `feat/domain-audit-foundation` with `feat(harness):` and `docs(harness):` scopes — commit body references the task number.

- [ ] 9. After PR merge, archive the change
      DoD:
      - `mkdir -p .openspec/specs/harness && mv .openspec/changes/inc-024-detector-type-vs-di/specs/harness/spec.md .openspec/specs/harness/inc-024-type-vs-di.md`.
      - Append to `.openspec/CHANGELOG.md`: `2026-08-05 — inc-024-detector-type-vs-di — symbol-axis classifier (suffix positive-list + brace-AST fallback) suppresses INC-003 for legitimate type-only imports`.
      - Delete `.openspec/changes/inc-024-detector-type-vs-di/` (rest of the folder).

- [ ] 10. Commit the standalone INCIDENTS.md markdown lint fixes
      DoD:
      - `.harness/INCIDENTS.md` MD024 (duplicate heading), MD060 (table column style), MD040 (×7 fenced code language tags) — already fixed in this session, pending commit.
      - One commit `docs(root): fix INCIDENTS.md markdown lint — MD024/MD040/MD060` (note: scope is `root` because `harness` is not in the commitlint allowlist — see CLAUDE.md §4).
      - Verify: `npx markdownlint-cli .harness/INCIDENTS.md` reports no MD024/MD040/MD060 violations.
