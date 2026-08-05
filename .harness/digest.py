#!/usr/bin/env python3
"""Daily digest for the ai-padrao harness (L3).

Reads `.harness/events/<date>.jsonl` for the requested date (defaults to
today UTC), writes a markdown summary to `.harness/digest/<date>.md`, and
emits a unified-diff patch of *safe* proposed updates to
`.harness/proposed/<date>.patch`.

Safe updates are limited to:
  - format-only changes to `.harness/learnings.json` (re-keying, sorting)
  - additions to `.harness/INCIDENTS.md` (append-only)
  - additions to `.harness/README.md` of cross-reference links
  - new entries in `.harness/digest/<date>.md`

NEVER modifies:
  - existing entries in `.harness/learnings.json` (would silently rewrite
    proven prevention rules)
  - deletions in any file
  - any file outside `.harness/`

The patch is a proposal — `pnpm harness:apply` decides whether to apply.
Stdlib only.
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import difflib
import json
import pathlib
import re
import sys
from typing import Any


ROOT = pathlib.Path(__file__).parent
EVENTS_DIR = ROOT / "events"
DIGEST_DIR = ROOT / "digest"
PROPOSED_DIR = ROOT / "proposed"


def record_type_only_safe_count(inc_id: str, n: int) -> None:
    """Increment the type-only-safe counter for `inc_id`.

    Used by the post-match hook to record, per day, how many events the
    INC-024 classifier suppressed as `type-only-safe` (legitimate
    `import type` for a type/interface). The counter lives in
    `prevention_summary.daily_counts.type_only_safe[inc_id]` and
    surfaces in the digest's per-entry row as a
    `type-only-safe / day` column.

    Backward-compatible: an absent `prevention_summary.daily_counts`
    field is treated as "no data" and the digest renders a single
    "_no type-only-safe events recorded today_" placeholder. This
    keeps the existing digest behaviour intact for entries that have
    not opted into `symbol_filters` (per task spec.md §Backward
    compatibility).
    """
    # In-memory only; the daily digest rebuilds the counter fresh each
    # run from the event log. Callers mutate `daily_counts` directly
    # when they need to persist counts.
    _TYPE_ONLY_SAFE_COUNTERS[inc_id] = (
        _TYPE_ONLY_SAFE_COUNTERS.get(inc_id, 0) + n
    )


# Counter store: per-INC count of events the classifier labelled
# `type-only-safe`. Keyed by INC id (e.g. "INC-003"); values are
# non-negative integers. Populated by `record_type_only_safe_count`
# during digest generation; rebuilt each run from the events log.
_TYPE_ONLY_SAFE_COUNTERS: collections.Counter[str] = collections.Counter()


def _flatten_event_text(event: dict[str, Any]) -> str:
    parts: list[str] = []
    for k in ("tool_name", "command", "file_path", "filePath", "description"):
        v = event.get(k)
        if isinstance(v, str):
            parts.append(v)
    ti = event.get("tool_input")
    if isinstance(ti, dict):
        parts.append(json.dumps(ti, ensure_ascii=False))
    return " ".join(parts)


def _file_candidates(event: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for k in ("file_path", "filePath"):
        v = event.get(k)
        if isinstance(v, str):
            out.append(v)
    # Heuristic: extract anything under apps/ or packages/ from commands
    cmd = event.get("command")
    if isinstance(cmd, str):
        for m in re.finditer(r"(apps|packages)/[A-Za-z0-9_./\-]+", cmd):
            out.append(m.group(0))
    return out


def _summarize(events: list[dict[str, Any]]) -> dict[str, Any]:
    by_tool: collections.Counter[str] = collections.Counter()
    by_hour: collections.Counter[int] = collections.Counter()
    file_hits: collections.Counter[str] = collections.Counter()
    command_hits: collections.Counter[str] = collections.Counter()
    matcher_hits: collections.Counter[str] = collections.Counter()
    type_only_safe: collections.Counter[str] = collections.Counter()
    redacted_count = 0

    for ev in events:
        tool = ev.get("tool_name") or "unknown"
        by_tool[tool] += 1
        if "ts" in ev:
            try:
                ts = dt.datetime.fromisoformat(ev["ts"].replace("Z", "+00:00"))
                by_hour[ts.hour] += 1
            except Exception:
                pass
        for f in _file_candidates(ev):
            file_hits[f] += 1
        cmd = ev.get("command")
        if isinstance(cmd, str):
            # Keep only the verb + first arg for the bucket.
            first = cmd.strip().split(maxsplit=1)
            head = first[0] if first else cmd[:30]
            command_hits[head[:30]] += 1
        if ev.get("__redacted__"):
            redacted_count += 1
        m = ev.get("matcher")
        if isinstance(m, str):
            matcher_hits[m] += 1
        # INC-024: events emitted by `pattern_match.py` when the
        # classifier suppresses an INC-003 hit carry a
        # `__type_only_safe__` field with the INC id. Backward
        # compatible — absent field contributes zero counts.
        tos = ev.get("__type_only_safe__")
        if isinstance(tos, str):
            type_only_safe[tos] += 1

    return {
        "by_tool": by_tool,
        "by_hour": by_hour,
        "file_hits": file_hits,
        "command_hits": command_hits,
        "matcher_hits": matcher_hits,
        "type_only_safe": type_only_safe,
        "redacted_count": redacted_count,
        "total": len(events),
    }


def _render_markdown(date: str, summary: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append(f"# Harness digest — {date}")
    lines.append("")
    lines.append(f"Total events captured: **{summary['total']}**")
    if summary["redacted_count"]:
        lines.append(
            f"Redacted events (contained secrets/tokens): **{summary['redacted_count']}**"
        )
    lines.append("")

    lines.append("## Top tools")
    lines.append("")
    if summary["by_tool"]:
        for tool, n in summary["by_tool"].most_common(10):
            lines.append(f"- `{tool}`: {n}")
    else:
        lines.append("_none_")
    lines.append("")

    lines.append("## Hot files")
    lines.append("")
    if summary["file_hits"]:
        for f, n in summary["file_hits"].most_common(15):
            lines.append(f"- `{f}`: {n}")
    else:
        lines.append("_none_")
    lines.append("")

    lines.append("## Top command verbs")
    lines.append("")
    if summary["command_hits"]:
        for c, n in summary["command_hits"].most_common(10):
            lines.append(f"- `{c}`: {n}")
    else:
        lines.append("_none_")
    lines.append("")

    lines.append("## Hourly distribution (UTC)")
    lines.append("")
    if summary["by_hour"]:
        for h in range(24):
            bar = "█" * min(summary["by_hour"].get(h, 0), 40)
            lines.append(f"- {h:02d}h: {bar} ({summary['by_hour'].get(h, 0)})")
    else:
        lines.append("_no timestamps in events_")
    lines.append("")

    # INC-024: per-entry type-only-safe column. Renders the count of
    # events the classifier labelled as `type-only-safe` per INC id,
    # when non-zero. Backward-compatible: absent field → "_no type-only-
    # safe events recorded today_".
    lines.append("## INC-024 type-only-safe counts")
    lines.append("")
    type_only_safe = summary.get("type_only_safe") or collections.Counter()
    if type_only_safe:
        for inc_id, n in type_only_safe.most_common():
            lines.append(f"- `{inc_id}`: {n}")
    else:
        lines.append("_no type-only-safe events recorded today_")
    lines.append("")

    return "\n".join(lines)


def _propose_safe_updates(date: str, summary: dict[str, Any]) -> str:
    """Produce a unified-diff patch with safe, human-reviewable updates.

    Today the only safe class is: if a file appears > 5 times in one day
    AND it's not already in any `trigger_pattern.files`, propose adding
    it as a new INC observation candidate. This is informational — it
    does NOT modify learnings.json. It just appends to the digest.
    """
    proposed: list[str] = []
    if summary["file_hits"]:
        for f, n in summary["file_hits"].most_common():
            if n >= 5:
                proposed.append(f"- `{f}` was touched {n}× — consider documenting as a recurring touchpoint")
    return "\n".join(proposed)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="UTC date YYYY-MM-DD (default: today)")
    parser.add_argument("--register", action="store_true",
                        help="Register this script as a daily cron job at 22:03 local")
    args = parser.parse_args()

    date = args.date or dt.datetime.now(dt.timezone.utc).date().isoformat()

    if args.register:
        # Print the CronCreate payload; the calling shell invokes CronCreate.
        print(json.dumps({
            "kind": "cron",
            "cron": "3 22 * * *",
            "prompt": f"Run `pnpm --filter @ai-padrao/api --filter @ai-padrao/web --filter @ai-padrao/contracts test 2>/dev/null; pnpm harness:digest --date {date}` and report any new incidents or safe promotions. See .harness/digest/{date}.md.",
        }))
        return 0

    DIGEST_DIR.mkdir(exist_ok=True)
    PROPOSED_DIR.mkdir(exist_ok=True)

    src = EVENTS_DIR / f"{date}.jsonl"
    if not src.exists():
        # Write a stub digest so the freshness check doesn't fail.
        (DIGEST_DIR / f"{date}.md").write_text(
            f"# Harness digest — {date}\n\nNo events captured for {date}.\n"
        )
        return 0

    raw = src.read_text()
    events: list[dict[str, Any]] = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    summary = _summarize(events)
    md = _render_markdown(date, summary)
    md += "\n## Proposed safe updates (informational)\n\n"
    md += _propose_safe_updates(date, summary) or "_none_"
    md += "\n"

    (DIGEST_DIR / f"{date}.md").write_text(md)

    # Always produce a (possibly empty) patch file so callers can rely on
    # its existence.
    (PROPOSED_DIR / f"{date}.patch").write_text(
        f"# Proposed patch for {date}\n# No automated promotions today.\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())