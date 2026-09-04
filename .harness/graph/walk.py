"""Pure graph walk — given an event + learnings entries, return the proactive
codemod steps that apply. NO I/O, NO subprocess; unit-testable in isolation.

This is the "engine" half of the graph adapter. The `run.py` script wires it
to stdin + codemod subprocesses; this module just answers the question
"which INCs in `learnings.json` would apply a codemod to this event's
file_path?".
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any


# Resolved at import time; tests may override with monkey-patch.
HARNESS_DIR: Path = Path(__file__).resolve().parent.parent
CODEMODS_DIR: Path = HARNESS_DIR / "codemods"


def _glob_to_regex(glob: str) -> re.Pattern[str]:
    """Compile a glob like `apps/api/src/**/*.ts` to a case-insensitive regex.

    Mirrors `pattern_match._compile_files` so the matching semantics stay
    consistent across the L2 detector and the graph engine. The escape +
    replacement order is important: `re.escape` first, then the `\\*` we
    inserted becomes `.*`.
    """
    return re.compile(
        re.escape(glob).replace(r"\*", ".*").replace(r"\?", "."),
        flags=re.IGNORECASE,
    )


def _resolve_relative_path(file_path: str) -> str:
    """Strip the harness repo prefix to get a relative path for glob matching.

    Glob patterns in `learnings.json` are repo-relative (`apps/api/src/...`)
    so absolute paths from the hook payload must be normalised. We only
    strip the prefix when the file lives under the harness repo — files
    outside (e.g. `/tmp/foo.ts`) are returned unchanged and will simply not
    match any glob.
    """
    if not file_path:
        return ""
    try:
        p = Path(file_path)
        if p.is_absolute():
            try:
                return str(p.relative_to(HARNESS_DIR.parent))
            except ValueError:
                pass
        return file_path
    except (OSError, ValueError):
        return file_path


def _find_codemod_path(inc_id: str) -> Path | None:
    """Map `INC-NNN` to `.harness/codemods/inc-NNN-*.py`; None if absent."""
    if not inc_id or not inc_id.startswith("INC-"):
        return None
    num = inc_id[len("INC-"):]
    pattern = f"inc-{num}-*.py"
    if not CODEMODS_DIR.exists():
        return None
    matches = sorted(CODEMODS_DIR.glob(pattern))
    return matches[0] if matches else None


def _file_path_from_event(event: dict[str, Any]) -> str:
    fp = event.get("file_path") or event.get("filePath") or ""
    tool_input = event.get("tool_input")
    if isinstance(tool_input, dict):
        ti_fp = tool_input.get("file_path") or tool_input.get("filePath")
        if isinstance(ti_fp, str) and ti_fp and not fp:
            fp = ti_fp
    return fp or ""


def walk(
    event: dict[str, Any],
    learnings_entries: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """For a mutation event, return the list of codemod-applicable INCs.

    Output shape:
        [
            {
                "inc_id": "INC-NNN",
                "codemod_path": "/abs/path/to/inc-NNN-*.py",
                "would_change": None,   # filled in by run.py after --check
                "exit_code": None,
                "file_path": "...",     # absolute, as seen by the hook
                "rel_path": "...",      # repo-relative, used for glob match
            },
            ...
        ]

    Bash / Read / TodoWrite / MCP events return `[]` — the graph engine only
    acts on mutations. Entries without a matching codemod file are skipped
    (the graph engine never suggests "apply" without an actual codemod
    available — it would be a lie).
    """
    tool_name = (event.get("tool_name") or "").strip()
    if tool_name not in ("Edit", "Write", "MultiEdit"):
        return []

    file_path = _file_path_from_event(event)
    if not file_path:
        return []

    rel_path = _resolve_relative_path(file_path)
    if not rel_path:
        return []

    out: list[dict[str, Any]] = []
    for entry in learnings_entries:
        pat = entry.get("trigger_pattern") or {}
        globs = [g for g in (pat.get("files") or []) if isinstance(g, str)]
        if not globs:
            continue
        matched = False
        for g in globs:
            try:
                rx = _glob_to_regex(g)
                if rx.search(rel_path) or rx.search(file_path):
                    matched = True
                    break
            except re.error:
                continue
        if not matched:
            continue
        inc_id = entry.get("id")
        if not isinstance(inc_id, str):
            continue
        codemod = _find_codemod_path(inc_id)
        if codemod is None:
            continue
        out.append({
            "inc_id": inc_id,
            "codemod_path": str(codemod),
            "would_change": None,
            "exit_code": None,
            "file_path": file_path,
            "rel_path": rel_path,
        })
    return out
