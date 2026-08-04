#!/usr/bin/env python3
"""Pattern matcher for the inline harness detector (L2).

Reads NDJSON from stdin (the recent event window produced by `.harness/detect.sh`),
loads the canonical trigger_pattern for every entry in `.harness/learnings.json`,
and emits the matched INC id on stdout (empty if no match).

Match heuristic: a pattern is considered matched when, within the window:
  - at least 2 events touch any of `trigger_pattern.files[]` (substring
    match against the dumped event payload), AND
  - any of `trigger_pattern.symbols[]` appears as a substring in the
    combined event text.

Either axis may be empty. A pattern with no `files` matches on symbols alone;
a pattern with no `symbols` matches on file hits alone. A pattern with both
axes requires both.

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


# INC-017: documentation-path filter. Events that target docs paths
# (or are read-only diagnostic bash) are excluded from the file-axis count
# so that prose about an INC pattern is not mistaken for code violating it.
# The symbol-axis still uses the full combined text. See the INC-017
# narrative in .harness/INCIDENTS.md for the full design rationale.
SOURCE_PATH_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^docs/"),
    re.compile(r"^\.harness/INCIDENTS\.md$"),
    re.compile(r"^\.harness/learnings\.json$"),
)
_DIAGNOSTIC_BASH_RE: re.Pattern[str] = re.compile(
    r"^\s*(?:grep|cat|head|tail|wc|ls|find|md5sum)\b"
    r"|python3\s+-c\b"
)


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

    See INC-017. The file-axis gate exists to catch code violations under
    the runtime source globs declared in learnings.json. Write/Edit events
    whose `file_path` lives under a documentation tree, plus read-only
    diagnostic bash, do not touch runtime source — even if their payloads
    happen to mention a trigger symbol. Excluding them here keeps the gate
    accurate without weakening symbol-axis coverage.
    """
    fp = event.get("file_path") or event.get("filePath") or ""
    if isinstance(fp, str) and fp:
        for rx in SOURCE_PATH_PATTERNS:
            if rx.search(fp):
                return True
    if event.get("tool_name") == "Bash":
        cmd = event.get("command") or ""
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
        if not files and not symbols:
            # No trigger pattern declared — detector can't fire.
            continue

        # File-axis check (skip if no files declared; symbols-only patterns
        # don't need a file hit).
        file_hits = 0
        if files:
            compiled_files = [
                re.compile(
                    re.escape(f).replace(r"\*", ".*").replace(r"\?", "."),
                    flags=re.IGNORECASE,
                )
                for f in files
            ]
            for ev in window:
                if _is_documentation_event(ev):
                    # INC-017: docs-path and diagnostic-bash events are
                    # excluded from the file-axis count. The symbol-axis
                    # still sees them via the combined text.
                    continue
                ev_text = _event_text(ev)
                for rx in compiled_files:
                    if rx.search(ev_text):
                        file_hits += 1
                        break  # one match per event is enough
            if file_hits < MIN_HITS:
                continue

        # Symbol-axis check (skip if no symbols declared; files-only
        # patterns match on file hits alone).
        if symbols:
            if not any(s in combined_text for s in symbols):
                continue

        sys.stdout.write(entry["id"] + "\n")
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())