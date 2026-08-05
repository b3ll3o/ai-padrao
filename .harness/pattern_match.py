#!/usr/bin/env python3
"""Pattern matcher for the inline harness detector (L2).

Reads NDJSON from stdin (the recent event window produced by `.harness/detect.sh`),
loads the canonical trigger_pattern for every entry in `.harness/learnings.json`,
and emits the matched INC id on stdout (empty if no match).

Match heuristic: a pattern is considered matched when, within the window:
  - at least 2 events touch any of `trigger_pattern.files[]` (substring
    match against the dumped event payload), AND
  - any of `trigger_pattern.symbols[]` (or `shapes[]`) appears as a
    substring/regex in the combined event text.

Either axis may be empty. A pattern with no `files` matches on symbols alone;
a pattern with no `symbols` matches on file hits alone. A pattern with both
axes requires both. INC-023 further restricts the symbol/shape combined
text to events that hit the file-axis glob, so edits to .harness/* (which
legitimately quote the patterns-to-detect) don't pollute the gate.

The check is intentionally conservative — false positives are surfaced as
confirmation prompts (the user can always say "continue"), but false
negatives let known bugs reincarnate. Stdlib only.
"""

from __future__ import annotations

import json
import re
import sys
import pathlib
from typing import Any, Literal


# INC-024: positive-list of type-only binding-name suffixes. An
# `import type { X, Y, Z }` whose every binding ends in one of these
# suffixes is classified as `type-only-safe`; INC-003 is NOT emitted.
# This mirrors `.harness/learnings.json →
# prevention_summary.by_auto_check_type.symbol_axis_classifier` and the
# per-entry `trigger_pattern.symbol_filters.safe_suffixes` array so
# the matcher keeps working even when `learnings.json` is being edited
# (the gap that INC-023 was designed to close for `import type`).
TYPE_ONLY_SUFFIXES: tuple[str, ...] = (
    "Type",
    "Interface",
    "Dto",
    "Context",
    "Spec",
    "Map",
    "Key",
    "Schema",
)

# INC-024: cap on bindings per single `import type` statement. >100
# names in one brace body is almost certainly a barrel re-export
# (`import type { … } from "@ai-padrao/contracts"`); the matcher can't
# classify those cheaply and falls back to the prior behaviour
# (operator confirm).
TYPE_ONLY_BINDING_LIMIT = 100


BindingClass = Literal["class-di-risk", "type-only-safe", "indeterminate"]


def classify_import_type_binding(line: str) -> BindingClass:
    """Classify a single line containing `import type` for INC-003 risk.

    Three outputs:
      - `"type-only-safe"` — every binding in the brace body is either
        suffix-marked (see `TYPE_ONLY_SUFFIXES`) or lowercase; INC-003
        MUST NOT be emitted for this line.
      - `"class-di-risk"` — at least one binding has a leading uppercase
        character and no registered suffix; INC-003 MUST be emitted.
      - `"indeterminate"` — the brace body has >`TYPE_ONLY_BINDING_LIMIT`
        bindings, OR no brace body is found within the first 200 chars;
        the matcher falls back to today's behaviour.

    Pure function (no I/O, no regex compile beyond what `re` already
    provides). Multi-line `import type` statements are supported via a
    brace-balanced forward walk; this single-argument shape makes the
    helper trivial to unit-test in isolation (Task 4).
    """
    if not isinstance(line, str) or "import type" not in line:
        return "indeterminate"

    # 200-char lookahead: a well-formed `import type { … }` always opens
    # the brace within ~80 chars; 200 gives ample slack for long paths
    # while keeping the parse bounded.
    head = line[:200]
    open_brace_idx = head.find("{")
    if open_brace_idx == -1:
        return "indeterminate"

    # Walk forward from the opening brace to find the matching close,
    # tolerating nested braces (rare but possible in default-value
    # annotations) and string-literal braces. For inline `import type`
    # statements, the brace body is the conventional binding list.
    depth = 0
    close_brace_idx = -1
    for i in range(open_brace_idx, len(line)):
        ch = line[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                close_brace_idx = i
                break
    if close_brace_idx == -1:
        return "indeterminate"

    body = line[open_brace_idx + 1:close_brace_idx]
    # Split on top-level commas; trim each piece and drop empties.
    # A real binding token is `[A-Za-z_$][A-Za-z0-9_$]*` plus optional
    # whitespace, possibly followed by ` as <alias>` (TS rename syntax).
    raw_bindings = [b.strip() for b in body.split(",")]
    bindings: list[str] = []
    for raw in raw_bindings:
        if not raw:
            continue
        # `Foo as Bar` → keep the source name `Foo` (the bind-on-this-
        # side matters, not the local alias).
        head_token = raw.split()[0]
        if re.match(r"^[A-Za-z_$][A-Za-z0-9_$]*$", head_token):
            bindings.append(head_token)

    if not bindings:
        return "indeterminate"
    if len(bindings) > TYPE_ONLY_BINDING_LIMIT:
        return "indeterminate"

    # Classify each binding:
    #   - lowercase → safe (convention: types/interfaces start upper).
    #   - matches a registered suffix → safe (heuristic).
    #   - uppercase and no suffix → class-DI risk.
    saw_risk = False
    for name in bindings:
        if name[0].islower():
            continue
        if any(name.endswith(suffix) for suffix in TYPE_ONLY_SUFFIXES):
            continue
        saw_risk = True
        break

    return "class-di-risk" if saw_risk else "type-only-safe"


# INC-017 + INC-018 + INC-019: documentation-path and ephemeral-path
# filters. Events that target docs paths, harness internals, worktree
# sessions, /tmp/ scratch, OR run diagnostic-only bash (grep/cat/etc.,
# inline python -c, python heredocs) are excluded from the file-axis
# count. The symbol-axis still uses scoped combined text (INC-023).
SOURCE_PATH_PATTERNS: tuple[re.Pattern[str], ...] = (
    # absolute or relative path under docs/ or .harness/
    re.compile(r"(?:^|/)(?:docs/|\.harness/)"),
    # worktree sessions
    re.compile(r"\.claude/worktrees/"),
    # ephemeral test scratch
    re.compile(r"(?:^|/)/tmp/"),
)
# INC-019: diagnostic commands can appear after whitespace or shell
# separators (`;`, `&`, `|`), not only at position 0.
_DIAGNOSTIC_BASH_RE: re.Pattern[str] = re.compile(
    r"(?:^|[\s;&|]+)(?:grep|cat|head|tail|wc|ls|find|md5sum)\b"
    r"|python3\s+(?:-c\b|<<)"
)
# INC-018: TodoWrite events carry prose, never mutate source.
_TODO_TOOL_NAME = "TodoWrite"
# INC-020: alphabetic symbols use word boundaries so `xit` doesn't
# match the substring inside `exit`, `exiting`, `exits`.
_ALPHA_RE: re.Pattern[str] = re.compile(r"^[A-Za-z]+$")


def _symbol_matches(symbol: str, text: str) -> bool:
    """Return True when `symbol` is found in `text` with appropriate boundaries.

    Alphabetic symbols (e.g. `xit`, `xdescribe`, `xtest`) use word boundaries
    so substrings inside unrelated words don't trigger. All other symbols
    use plain substring match — they're already self-delimiting.
    """
    if _ALPHA_RE.match(symbol):
        return re.search(r"\b" + symbol + r"\b", text) is not None
    return symbol in text


ROOT = pathlib.Path(__file__).parent
WINDOW_SIZE = 20
MIN_HITS = 2


def _event_text(event: dict[str, Any]) -> str:
    """Flatten an event into a single string for substring matching.

    Used by the symbol-axis check, which legitimately wants to scan
    Write/Edit content for trigger patterns (e.g. `import type` in the
    actual source body).
    """
    parts: list[str] = []
    for k in (
        "tool_name",
        "command",
        "file_path",
        "filePath",
        "description",
        "matcher",
    ):
        v = event.get(k)
        if isinstance(v, str):
            parts.append(v)
    tool_input = event.get("tool_input")
    if isinstance(tool_input, dict):
        parts.append(json.dumps(tool_input, ensure_ascii=False))
    return " ".join(parts)


def _file_path_for_axis(event: dict[str, Any]) -> str:
    """Return the file-path-relevant text for file-axis glob matching.

    INC-025: file-axis globs target runtime source paths. The glob MUST
    match the FILE PATH only — not against Write/Edit tool_input.content,
    which may legitimately quote trigger patterns. The clearest case:
    a template file's header comment like
    `// Reference (live example): apps/api/src/contexts/users/.../user.mapper.ts`
    that documents the live example SHOULD NOT count as an INC-003
    file-axis hit (the file lives at `.claude/skills/.../mapper.ts.template`,
    nowhere near the runtime source tree).

    Earlier versions flattened `tool_input` into event text and matched
    the glob against content strings, producing false positives on every
    template, doc snippet, unit-test fixture, or commit message that
    mentioned a real source path. This helper restores the intended
    semantics: globs describe WHERE the violation lives, not WHAT it
    looks like.

    For Bash events the command text is included, because file paths
    naturally appear in shell commands (e.g.
    `pnpm test apps/api/src/foo.spec.ts`). Diagnostic-only bash
    (grep/cat/head/...) is already filtered upstream by
    `_is_documentation_event` (INC-019), so commands that survive to
    here are non-trivial and may legitimately mention a runtime path.
    """
    fp = event.get("file_path") or event.get("filePath") or ""
    tool_input = event.get("tool_input")
    if isinstance(tool_input, dict):
        ti_fp = tool_input.get("file_path") or tool_input.get("filePath")
        if isinstance(ti_fp, str) and ti_fp:
            fp = fp or ti_fp
    parts: list[str] = [fp]
    if event.get("tool_name") == "Bash":
        cmd = ""
        if isinstance(tool_input, dict):
            cmd = tool_input.get("command") or ""
        if not cmd:
            cmd = event.get("command") or ""
        if isinstance(cmd, str) and cmd:
            parts.append(cmd)
    return " ".join(p for p in parts if p)


def _is_documentation_event(event: dict[str, Any]) -> bool:
    """Return True when the event should be excluded from the file-axis count.

    See INC-017 + INC-018 + INC-019. The file-axis gate exists to catch code
    violations under the runtime source globs declared in learnings.json.
    Events that don't mutate runtime source — documentation-path writes,
    diagnostic bash, read-only inspection, TodoWrite session planning,
    worktree sessions, /tmp/ scratch — MUST be excluded even if their
    payloads happen to mention a trigger symbol. Excluding them here keeps
    the gate accurate without weakening symbol-axis coverage.
    """
    if event.get("tool_name") == _TODO_TOOL_NAME:
        return True
    # INC-018: file_path can live at top level OR in tool_input.file_path.
    fp = event.get("file_path") or event.get("filePath") or ""
    tool_input = event.get("tool_input")
    if isinstance(tool_input, dict):
        ti_fp = tool_input.get("file_path") or tool_input.get("filePath") or ""
        if isinstance(ti_fp, str) and ti_fp:
            fp = fp or ti_fp
    if isinstance(fp, str) and fp:
        for rx in SOURCE_PATH_PATTERNS:
            if rx.search(fp):
                return True
    if event.get("tool_name") == "Bash":
        # INC-018: command lives in tool_input.command, not at top level.
        cmd = ""
        if isinstance(tool_input, dict):
            cmd = tool_input.get("command") or ""
        cmd = cmd or event.get("command") or ""
        if isinstance(cmd, str) and _DIAGNOSTIC_BASH_RE.search(cmd):
            return True
    return False


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        return 0

    events: list[dict[str, Any]] = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    if not events:
        return 0

    window = events[-WINDOW_SIZE:]
    combined_text = " ".join(_event_text(e) for e in window)

    learnings_path = ROOT / "learnings.json"
    if not learnings_path.exists():
        return 0
    try:
        learnings = json.loads(learnings_path.read_text())
    except json.JSONDecodeError:
        return 0

    for entry in learnings.get("entries", []):
        pat = entry.get("trigger_pattern") or {}
        files = [f for f in (pat.get("files") or []) if isinstance(f, str)]
        symbols = [s for s in (pat.get("symbols") or []) if isinstance(s, str)]
        # INC-021: shapes are regex patterns (e.g. token shapes for INC-016).
        shapes = [s for s in (pat.get("shapes") or []) if isinstance(s, str)]
        # INC-022: required_features anti-pattern gate — fires only when ≥1
        # feature is missing from this script.
        required_features = [
            f for f in (pat.get("required_features") or []) if isinstance(f, str)
        ]
        if not files and not symbols and not shapes and not required_features:
            continue
        if required_features:
            pm_text = (ROOT / "pattern_match.py").read_text(encoding="utf-8")
            if all(f in pm_text for f in required_features):
                continue  # all required features present — no-op guard

        # INC-023: when `files` is declared, restrict symbol/shape axes to
        # the SAME events that count toward the file-axis. Otherwise edits
        # to .harness/learnings.json (which legitimately contains token-shape
        # literals as patterns-to-detect) and docs prose quoting trigger
        # patterns would false-fire.
        scoped_text = combined_text
        if files:
            compiled_files = [
                re.compile(
                    re.escape(f).replace(r"\*", ".*").replace(r"\?", "."),
                    flags=re.IGNORECASE,
                )
                for f in files
            ]
            scoped_parts: list[str] = []
            file_hits = 0
            for ev in window:
                if _is_documentation_event(ev):
                    continue
                if ev.get("tool_name") == "Read":
                    continue  # INC-018: Read doesn't mutate
                # INC-025: file-axis glob matches the FILE PATH ONLY
                # (via _file_path_for_axis), not Write/Edit content. Symbol-axis
                # still scans full event text via _event_text below, so a
                # real `import type` in a real source file is still caught.
                ev_path = _file_path_for_axis(ev)
                hit = False
                for rx in compiled_files:
                    if rx.search(ev_path):
                        hit = True
                        break
                if hit:
                    file_hits += 1
                    scoped_parts.append(_event_text(ev))
            if file_hits < MIN_HITS:
                continue
            scoped_text = " ".join(scoped_parts)

        # INC-020: alphabetic symbols use word boundaries.
        if symbols:
            if not any(_symbol_matches(s, scoped_text) for s in symbols):
                continue

        # INC-021 + INC-023: shapes restricted to file-axis hits.
        if shapes:
            if not any(re.search(s, scoped_text) for s in shapes):
                continue

        # INC-024: when the symbol axis hit came from `import type` AND
        # the entry has a `symbol_filters.safe_suffixes` list, classify
        # each matched line and suppress the emission for events the
        # classifier labels `type-only-safe`. Today's emit path is
        # preserved for `class-di-risk` and `indeterminate`.
        symbol_filters = pat.get("symbol_filters") or {}
        if "import type" in symbols and isinstance(symbol_filters, dict):
            safe_suffixes = symbol_filters.get("safe_suffixes") or []
            if isinstance(safe_suffixes, list) and safe_suffixes:
                # Build a per-line classifier view by splitting the
                # combined_text on `import type` boundaries. Each chunk
                # beyond the first starts with `import type { … }` —
                # the only shape the classifier needs.
                chunks = scoped_text.split("import type")[1:]
                all_safe = True
                saw_any = False
                for chunk in chunks:
                    # Re-prepend the marker so the classifier sees the
                    # full `import type { … }` shape.
                    sample = "import type" + chunk
                    cls = classify_import_type_binding(sample)
                    if cls == "class-di-risk":
                        all_safe = False
                        break
                    if cls == "indeterminate":
                        saw_any = True
                        # Keep scanning; only a class-di-risk forces
                        # the prior emit path.
                # When every sample resolved to `type-only-safe`, the
                # entry is suppressed for this window. Mixed
                # (safe + indeterminate) still emits — preserves the
                # operator-confirm contract for anything we don't yet
                # recognise.
                if chunks and all_safe and not saw_any:
                    continue

        sys.stdout.write(entry["id"] + "\n")
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())