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
from typing import Any


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
    """Flatten an event into a single string for substring matching."""
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
                ev_text = _event_text(ev)
                hit = False
                for rx in compiled_files:
                    if rx.search(ev_text):
                        hit = True
                        break
                if hit:
                    file_hits += 1
                    scoped_parts.append(ev_text)
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

        sys.stdout.write(entry["id"] + "\n")
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())