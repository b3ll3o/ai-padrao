# Spec: Harness — INC-017 detector excludes documentation paths

This spec describes the behavior of `.harness/pattern_match.py` and the L2 inline detector after INC-017 is implemented. The keywords **SHALL**, **SHOULD**, and **MAY** follow RFC 2119.

## Requirements

### File-axis exclusion

- WHEN a PostToolUse event has `tool_name ∈ {Write, Edit}` AND `file_path` matches the regex `^docs/` (anchored to repository root),
  THE detector SHALL exclude that event from the file-axis computation,
  AND the event's text SHALL still contribute to the symbol-axis combined blob.

- WHEN a PostToolUse event has `file_path == ".harness/INCIDENTS.md"`,
  THE detector SHALL exclude that event from the file-axis computation.

- WHEN a PostToolUse event has `file_path == ".harness/learnings.json"`,
  THE detector SHALL exclude that event from the file-axis computation.

- WHEN a PostToolUse event has `tool_name == "Bash"` AND `command` matches the regex `^\s*(grep|cat|head|tail|wc|ls|find|md5sum)\b|python3\s+-c\b`,
  THE detector SHOULD exclude that event from the file-axis computation.

### Symbol-axis preservation

- THE symbol-axis computation SHALL continue to use the entire combined event text without exclusion.
- The MIN_HITS threshold for the file-axis SHALL remain at 2.
- An INC id SHALL be emitted only when both axes pass (file-axis ≥ MIN_HITS AND symbol-axis ≥ 1 substring hit).

### Learning record

- `.harness/learnings.json` SHALL contain an entry with `id: "INC-017"`, `category: "detector-design"`, `trigger_pattern: { files: [], symbols: [] }`.
- The `stats.total_incidents` field SHALL be 17 after INC-017 lands.
- `.harness/INCIDENTS.md` SHALL contain a section heading `## INC-017` with the same fields as INC-001..016 (Symptom, Root cause summary, Detection, Fix, Prevention).

### Auto-check (L4 enforcement)

- `.harness/check.sh` SHALL contain an INC-017 block that:
  - greps `pattern_match.py` for `SOURCE_PATH_PATTERNS` and asserts the match exists, AND
  - runs `python3 -m unittest .harness.test_pattern_match` and asserts exit code 0.
- A failing INC-017 block SHALL cause `.harness/check.sh` to exit non-zero.

### Regression tests

- `.harness/test_pattern_match.py` SHALL exist and SHALL contain three test methods:
  - `test_docs_only_window_no_match` — a 20-event window of Write events under `docs/decisions/` whose bodies quote the INC-002 symbol. The detector SHALL emit no INC id.
  - `test_code_window_still_matches` — a 20-event window with two or more events under the INC-002 source glob whose combined text contains the symbol. The detector SHALL emit `INC-002`.
  - `test_mixed_window_matches_code_side` — a 20-event window mixing two docs events with two code events, both quoting the symbol. The detector SHALL emit `INC-002`.
- The test file SHALL import only Python stdlib modules.
- The test file SHALL pass under `python3 -m unittest .harness.test_pattern_match`.

## Examples

### Scenario 1 — Agent writes `docs/decisions/ADR-005-*.md`

Given a fresh event window of 20 Write events all targeting paths under `docs/decisions/`, where several bodies contain the INC-002 symbol as part of explaining the rule, the detector reads the combined text, applies the file-axis exclude to all 20 events, finds 0 hits, short-circuits, and emits no INC id. The agent's commit proceeds without confirmation prompts.

### Scenario 2 — Agent writes `apps/api/src/modules/audit/audit.interceptor.ts` using the legacy response symbol

Given an event window with two or more Write events targeting paths under the INC-002 source glob, where at least one body uses the legacy response symbol, the detector's file-axis counts both events as hits (≥ MIN_HITS=2), the symbol-axis finds the substring, and INC-002 is emitted as before. Behavior for code violations is unchanged.

### Scenario 3 — Mixed window

Given an event window with two docs events quoting the symbol and two code events quoting the symbol, the file-axis counts only the two code events (≥ MIN_HITS=2), the symbol-axis still finds the substring in the combined text, and INC-002 is emitted. The docs events are present in the symbol-axis combined blob (preserving observability) but do not contribute to the file-axis gate.
