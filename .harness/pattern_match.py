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
        files = pat.get("files") or []
        symbols = pat.get("symbols") or []

        # A match requires the recent window to contain ≥ MIN_HITS events
        # whose flattened text touches any of the pattern's files (or
        # symbols — same concept, different axis). The "any-of" logic
        # matters because some patterns list `Dockerfile.dev` and
        # `Dockerfile.prod` as alternatives — we want the count of events
        # that touched one of them, not the count of distinct files hit.
        compiled_files = [
            re.compile(
                re.escape(f).replace(r"\*", ".*").replace(r"\?", "."),
                flags=re.IGNORECASE,
            )
            for f in files
            if isinstance(f, str)
        ]
        file_hits = 0
        for ev in window:
            ev_text = _event_text(ev)
            for rx in compiled_files:
                if rx.search(ev_text):
                    file_hits += 1
                    break  # one match per event is enough
        if file_hits < MIN_HITS:
            continue

        for sym in symbols:
            if not isinstance(sym, str):
                continue
            if sym in combined_text:
                sys.stdout.write(entry["id"] + "\n")
                return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())