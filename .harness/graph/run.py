"""Harness graph engine — proactive codemod suggestion.

Reads a Claude Code PostToolUse JSON payload from stdin. For mutation
events (Edit / Write / MultiEdit), asks `graph.walk` which INC entries'
file-axis globs match the event's path. For each match with a
corresponding codemod (`.harness/codemods/inc-NNN-*.py`), runs the
codemod in `--check` mode and emits a proactive announcement on
stderr if it would change the file.

Honours `HARNESS_L2_ENABLED` (INC-029). Audit log is best-effort — a
failed walk log write never blocks the operator's tool call.

Exit codes:
  0 = no proactive suggestion (or L2 disabled, or non-mutation event)
  2 = at least one codemod would change the file; INC id(s) on stderr
  1 = internal error (treated as no-op by the hook)
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

_HARNESS_DIR = Path(__file__).resolve().parent.parent
if str(_HARNESS_DIR) not in sys.path:
    sys.path.insert(0, str(_HARNESS_DIR))

from graph.walk import walk  # noqa: E402

LEARNINGS_PATH = _HARNESS_DIR / "learnings.json"
WALKS_DIR = _HARNESS_DIR / "graph" / "walks"
CODEMOD_TIMEOUT_SEC = 10


def _l2_disabled() -> bool:
    flag = os.environ.get("HARNESS_L2_ENABLED", "1")
    return flag.lower() in {"0", "false", "no", "off", ""}


def _load_learnings_entries() -> list[dict[str, Any]]:
    if not LEARNINGS_PATH.exists():
        return []
    try:
        data = json.loads(LEARNINGS_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    if not isinstance(data, dict):
        return []
    entries = data.get("entries")
    return list(entries) if isinstance(entries, list) else []


def _run_codemod_check(codemod_path: Path, file_path: str) -> tuple[int, str]:
    """Run `python3 <codemod> <file> --check` and return (rc, stderr).

    The codemod CLI expects the file path positionally followed by the
    `--check` flag (mirrors `codemods/run.sh`'s argument re-ordering).
    """
    try:
        result = subprocess.run(
            ["python3", str(codemod_path), file_path, "--check"],
            capture_output=True,
            text=True,
            timeout=CODEMOD_TIMEOUT_SEC,
            cwd=str(_HARNESS_DIR.parent),
        )
        return result.returncode, (result.stderr or "")
    except subprocess.TimeoutExpired:
        return 1, f"graph-runner: codemod timed out after {CODEMOD_TIMEOUT_SEC}s"
    except FileNotFoundError:
        return 1, "graph-runner: python3 not found"
    except OSError as exc:
        return 1, f"graph-runner: subprocess error ({exc})"


def _write_walk_audit(date_str: str, ts_str: str, payload: dict[str, Any]) -> None:
    """Best-effort audit log under `.harness/graph/walks/<date>/<ts>.json`.

    Failure here NEVER blocks the operator — the loop engine already raised
    the prompt, the audit is just a trace.
    """
    try:
        d = WALKS_DIR / date_str
        d.mkdir(parents=True, exist_ok=True)
        out = d / f"{ts_str}.json"
        out.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError:
        pass


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        return 0
    try:
        event = json.loads(raw)
    except json.JSONDecodeError:
        return 1

    if _l2_disabled():
        return 0

    tool_name = (event.get("tool_name") or "").strip()
    if tool_name not in ("Edit", "Write", "MultiEdit"):
        return 0  # Graph engine only acts on mutations.

    try:
        entries = _load_learnings_entries()
        steps = walk(event, entries)
    except Exception:
        return 1

    if not steps:
        return 0

    audit_steps: list[dict[str, Any]] = []
    any_would_change = False
    for step in steps:
        rc, stderr = _run_codemod_check(Path(step["codemod_path"]), step["file_path"])
        step["exit_code"] = rc
        step["would_change"] = (rc == 2)
        if stderr.strip():
            tail = stderr.strip().splitlines()
            step["stderr_tail"] = tail[-3:]
        audit_steps.append(step)
        if rc == 2:
            any_would_change = True
            codemod_name = Path(step["codemod_path"]).name
            sys.stderr.write(
                f"harness-graph: {step['inc_id']} codemod ({codemod_name}) "
                f"would change {step['file_path']}\n"
            )

    # Audit log (best-effort).
    now = _dt.datetime.utcnow()
    _write_walk_audit(
        date_str=now.strftime("%F"),
        ts_str=now.strftime("%H%M%S%f"),
        payload={
            "ts": now.isoformat() + "Z",
            "tool_name": tool_name,
            "file_path": steps[0]["file_path"],
            "rel_path": steps[0]["rel_path"],
            "steps": audit_steps,
        },
    )

    return 2 if any_would_change else 0


if __name__ == "__main__":
    sys.exit(main())
