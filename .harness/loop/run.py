"""Harness loop engine — typed event handler + session state.

Reads a Claude Code PostToolUse JSON payload from stdin, redacts it,
dispatches by `tool_name`, delegates the pattern-match decision to
`pattern_match.main()`, and persists session-level state to
`.harness/loop/state.json` (atomic temp+rename).

Honours `HARNESS_L2_ENABLED` (INC-029) — any falsy value (`0`, `false`,
`no`, `off`, empty) makes this invocation a no-op.

Architecturally this is a drop-in replacement for `.harness/detect.sh`
(typed dispatch + persistent state). The 28-test suite in
`test_pattern_match.py` is unaffected — this script delegates to
`pattern_match.main()` rather than re-implementing the matcher.

Exit codes:
  0 = no match (or L2 disabled or empty stdin)
  2 = match found; INC id printed to stderr
  1 = internal error (treated as no-match by the hook)
"""

from __future__ import annotations

import datetime as _dt
import io
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

# Make the harness root importable for `redact` / `pattern_match`.
_HARNESS_DIR = Path(__file__).resolve().parent.parent
if str(_HARNESS_DIR) not in sys.path:
    sys.path.insert(0, str(_HARNESS_DIR))

import pattern_match  # noqa: E402
import redact  # noqa: E402
from loop.state import LoopState  # noqa: E402

EVENTS_DIR = _HARNESS_DIR / "events"
# Must match `pattern_match.WINDOW_SIZE`.
WINDOW_SIZE = 20


# ---------------------------------------------------------------------------
# Escape hatch + helpers
# ---------------------------------------------------------------------------

def _l2_disabled() -> bool:
    """Return True when the operator has opted out via HARNESS_L2_ENABLED."""
    flag = os.environ.get("HARNESS_L2_ENABLED", "1")
    return flag.lower() in {"0", "false", "no", "off", ""}


def _today_events_path() -> Path:
    return EVENTS_DIR / (_dt.datetime.utcnow().strftime("%F") + ".jsonl")


def _load_recent_events(exclude_count: int = 0) -> list[dict[str, Any]]:
    """Load the last (WINDOW_SIZE - exclude_count) events from today's NDJSON.

    `exclude_count` lets the caller reserve the last N slots for the current
    event when building a synthetic window for `pattern_match`.
    """
    path = _today_events_path()
    if not path.exists():
        return []
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []
    keep = WINDOW_SIZE - exclude_count
    if keep <= 0:
        return []
    recent = lines[-keep:]
    out: list[dict[str, Any]] = []
    for ln in recent:
        ln = ln.strip()
        if not ln:
            continue
        try:
            out.append(json.loads(ln))
        except json.JSONDecodeError:
            continue
    return out


def _detect_with_window(window: list[dict[str, Any]]) -> str:
    """Run `pattern_match.main()` on a synthetic window; return first INC id or ''.

    The matcher writes one INC id per match to stdout and exits 0. This
    helper mimics that contract; it never raises (the matcher itself is
    defensive).
    """
    if not window:
        return ""
    ndjson = "\n".join(json.dumps(ev, ensure_ascii=False) for ev in window) + "\n"
    saved_in, saved_out = sys.stdin, sys.stdout
    try:
        sys.stdin = io.StringIO(ndjson)
        sys.stdout = io.StringIO()
        rc = pattern_match.main()
        out = sys.stdout.getvalue()
    finally:
        sys.stdin, sys.stdout = saved_in, saved_out
    if rc != 0:
        return ""
    for line in out.splitlines():
        line = line.strip()
        if line:
            return line
    return ""


def _file_path_from_event(event: dict[str, Any]) -> str:
    """Resolve the touched file path (handles top-level + tool_input nesting)."""
    fp = event.get("file_path") or event.get("filePath") or ""
    tool_input = event.get("tool_input")
    if isinstance(tool_input, dict):
        ti_fp = tool_input.get("file_path") or tool_input.get("filePath")
        if isinstance(ti_fp, str) and ti_fp:
            fp = fp or ti_fp
    return fp or ""


# ---------------------------------------------------------------------------
# Typed handlers — one per event kind
# ---------------------------------------------------------------------------

def _handle_read(event: dict[str, Any], state: LoopState) -> str:
    """INC-018: Read events don't mutate; record the path, skip the matcher."""
    state.record_read(_file_path_from_event(event))
    return ""


def _handle_mutation(event: dict[str, Any], state: LoopState) -> str:
    """Edit / Write / MultiEdit: record + run the matcher.

    The synthetic window puts the current event LAST so its payload
    dominates the symbol-axis scan (which `_event_text` reads from
    `tool_input.content` for Write/Edit).
    """
    fp = _file_path_from_event(event)
    state.record_mutation(fp, content_hash="")
    recent = _load_recent_events(exclude_count=1)
    window = recent + [event]
    return _detect_with_window(window)


def _handle_bash(event: dict[str, Any], state: LoopState) -> str:
    """Bash: run the matcher. Diagnostic-only commands (lint, ls, cat) are
    already excluded by `pattern_match._DIAGNOSTIC_BASH_RE` (INC-029)."""
    state.ops_counter += 1
    state.last_action_at = time.time()
    recent = _load_recent_events(exclude_count=1)
    window = recent + [event]
    return _detect_with_window(window)


def _handle_other(event: dict[str, Any], state: LoopState) -> str:
    """TodoWrite, MCP tools, anything else: count as an op, no matcher call.

    TodoWrite events are excluded from the matcher entirely (per INC-018)
    and would be double-evaluated if we ran the window through it.
    """
    state.ops_counter += 1
    state.last_action_at = time.time()
    return ""


# ---------------------------------------------------------------------------
# Dispatch + entry point
# ---------------------------------------------------------------------------

def _dispatch(event: dict[str, Any], state: LoopState) -> str:
    """Dispatch by tool_name. Returns matched INC id (or '')."""
    tool_name = (event.get("tool_name") or "").strip()
    if tool_name == "Read":
        return _handle_read(event, state)
    if tool_name in ("Edit", "Write", "MultiEdit"):
        return _handle_mutation(event, state)
    if tool_name == "Bash":
        return _handle_bash(event, state)
    return _handle_other(event, state)


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        # Empty stdin (UserPromptSubmit / Stop hooks re-use this entry;
        # only PostToolUse carries a payload).
        return 0
    try:
        event = json.loads(raw)
    except json.JSONDecodeError:
        return 1

    if _l2_disabled():
        return 0

    # The matcher reads the redacted payload indirectly via the events file
    # (capture.sh is responsible for that); the loop engine consumes the
    # raw payload here because it needs to add it to the in-memory window.
    # We still run it through `redact` before any persistence, which today
    # is a no-op (state doesn't store payloads), but guards future expansion.
    try:
        redacted = redact._redact(event)  # noqa: SLF001 — internal helper
        state = LoopState.load_from_disk()
        inc_id = _dispatch(redacted if isinstance(redacted, dict) else event, state)
        if inc_id:
            state.record_emit(inc_id)
        state.save_to_disk()
    except Exception:
        return 1

    if inc_id:
        sys.stderr.write(
            f"harness-loop: matched {inc_id} in recent events "
            "— confirm with user before proceeding\n"
        )
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
