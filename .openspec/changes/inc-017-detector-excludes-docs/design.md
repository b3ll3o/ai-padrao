# Design: INC-017 — Harness detector excludes documentation paths from file-axis match

Reference: `proposal.md` in this folder.

## Decisions

### Decision 1 — Where to apply the path filter (file-axis only, not symbol-axis)

**Context:** The detector has two axes. The file-axis counts how many of the last 20 events "touch" the trigger glob. The symbol-axis checks whether any trigger symbol appears in the combined text. Both must pass for an INC to fire (currently: file-axis ≥ MIN_HITS=2 AND symbol-axis ≥1 substring hit).

**Choice:** Apply the documentation exclude only on the file-axis computation. The symbol-axis continues to use the entire combined text.

**Rejected alternatives:**

- _Apply exclude on symbol-axis too._ Rejected because it would require per-symbol rewriting of every INC entry (INC-002 has 4 symbols, INC-003 has 1) and would silently weaken detection in scenarios where a single code event happens to mention a symbol without a matching file hit (already a low-priority case but defensible to keep).
- _Apply exclude on both axes via a single "is this event documentation?" predicate._ Rejected because the file-axis gate is the natural seam — the existing MIN_HITS=2 design already implies "file axis is the spine, symbol axis is the finetune".

### Decision 2 — Exact list of excluded paths

**Context:** Need an explicit, narrow, auditable list. Whitelist-by-default would be the safest but would require touching every INC's `trigger_pattern.files` and changing the semantics from "match this glob" to "match any path outside this deny list". That's a bigger refactor than this proposal justifies.

**Choice:** Hard-code three regexes at the top of `pattern_match.py`:

```
SOURCE_PATH_PATTERNS = [
    re.compile(r"^docs/"),                                  # any docs/ tree at repo root
    re.compile(r"^\.harness/INCIDENTS\.md$"),               # narrative log
    re.compile(r"^\.harness/learnings\.json$"),             # structured DB
]
```

Plus a fourth predicate for diagnostic bash:

```
_DIAGNOSTIC_BASH_RE = re.compile(
    r"^\s*(grep|cat|head|tail|wc|ls|find|md5sum)\b"
    r"|python3\s+-c\b"
)
```

An event is excluded from the file-axis if its `file_path` (or `filePath`) matches any of the first three regexes, OR its `tool_name == "Bash"` and `command` matches the fourth regex.

**Rejected alternatives:**

- _Exclude all events whose `tool_input` JSON-serialized length is above some threshold._ Rejected — that's a heuristic that conflates "large event" with "documentation event".
- _Exclude all `Write` events regardless of path._ Rejected — that would mask real code violations written via Write. INC-002 codemod uses Write to rewrite source files; we must keep matching those.
- _Exclude based on `tool_name == "Read"` only._ Rejected — Read events already don't carry the trigger substrings (they have file paths, not content). The bug is in Write + Bash, not Read.

### Decision 3 — How to express INC-017 in `learnings.json`

**Context:** INC-017 is unusual — it's about the detector itself, not about user code. The existing schema requires `trigger_pattern.files` (used for the file-axis match) and `prevention.auto_check` (used by L4). An empty `trigger_pattern` would prevent the entry from ever firing, which is wrong — INC-017 should never be a candidate for fire because it IS the detector's self-knowledge.

**Choice:** Use the existing schema with `trigger_pattern.files = []` AND `trigger_pattern.symbols = []`. The matcher already short-circuits on empty patterns (`if not files and not symbols: continue` at pattern_match.py:89-91). INC-017 will never match against user activity — that's the design intent. Its `auto_check` (presence of `SOURCE_PATH_PATTERNS` in pattern_match.py) is the only enforcement surface.

**Rejected alternatives:**

- _Add a new `meta` field to the schema._ Rejected — schema changes are out of scope for this fix.
- _Skip INC-017 entirely and just edit pattern_match.py._ Rejected — without the INC entry, the daily digest won't surface the fix as a learning, and a future cleanup wave might "simplify" the code by removing the exclude list, not knowing why it was there.

### Decision 4 — Test strategy

**Context:** The detector is pure-Python, stdlib-only, and currently has no unit tests. Adding the test infrastructure is part of this proposal.

**Choice:** New file `.harness/test_pattern_match.py` using `unittest`. Three test cases:

1. `test_docs_only_window_no_match`: Build a 20-event window of fake Write events under `docs/decisions/` whose bodies quote the INC-002 symbol. Assert that `main()` returns 0 and prints nothing to stdout.
2. `test_code_window_still_matches`: Build a 20-event window with 2 events under the INC-002 source glob whose `command`/`content` includes the symbol. Assert `main()` prints `INC-002`.
3. `test_mixed_window_matches_code_side`: 2 docs events + 2 code events quoting the symbol. Assert `main()` still prints `INC-002` (the code axis still passes).

The test is wired into `.harness/check.sh` as part of the INC-017 assertion: after the grep for `SOURCE_PATH_PATTERNS`, run `python3 -m unittest .harness.test_pattern_match` and fail if non-zero.

**Rejected alternatives:**

- _pytest._ Rejected — INC-013 forbids adding pytest (or any top-level binary dep) to capture hooks. unittest is stdlib.
- _Inline shell test (heredoc)._ Rejected — readability of a real test file is worth more than the LOC saved.
- _Property-based testing with hypothesis._ Rejected — adds a dependency. Out of scope.

### Decision 5 — Order of execution (depends on AGENTS.md precedence)

**Context:** AGENTS.md says "Start coding before `proposal.md` is approved" is a forbidden action. The fix touches a checked-in file (`pattern_match.py`) and so requires the proposal to be approved first.

**Choice:** This proposal enters the SDD flow: human approves → tasks execute in order from `tasks.md` → each task is one commit → after the PR merges, the change folder is archived per `.openspec/AGENTS.md` §5.

The proposal is the gate. No code change happens until the human says so.

## Open questions

- _Q1: Should `apps/<app>/README.md` (an app-level README) be excluded from the file-axis?_
  **Proposed answer:** No. App READMEs are typically read by humans but they also sometimes describe intentional anti-patterns ("don't do X — we used to do it"). Until we observe a false positive in an app-level README, the conservative choice is to keep them in scope. We can revisit if a future docs audit surfaces one.

- _Q2: What about `.openspec/` paths?_
  **Proposed answer:** Spec files are documentation too. But the false-positive class observed today is specifically `docs/decisions/`. `.openspec/` proposals are much larger and more varied — applying the exclude too broadly risks masking real violations in a proposal that quotes a code snippet. Defer until we observe a false positive there.

- _Q3: Does this fix interact with the daily digest (L3)?_
  **Proposed answer:** No. L3 reads the events JSONL and groups them into digests; it does not call `pattern_match.py`. INC-017 will appear in the next digest as a new entry in `learnings.json`, which is exactly what should happen.
