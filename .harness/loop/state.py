"""LoopState dataclass for the harness loop engine (`.harness/loop/run.py`).

Persists session-level state (recent paths, ops counter, emitted INCs) to
`.harness/loop/state.json` with atomic temp+rename. Stdlib-only per INC-013.

The state is intentionally cheap to load/save: the loop engine runs as a
PostToolUse hook, so the I/O budget is < 50 ms. State is best-effort
persistence — a corrupted `state.json` is treated as empty rather than
blocking the operator's tool call.
"""

from __future__ import annotations

import json
import os
import tempfile
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


# State file location. Resolved at import time; tests may override via
# `unittest.mock.patch.object(state, "STATE_PATH", tmp_path)`.
STATE_PATH: Path = Path(__file__).resolve().parent / "state.json"

# Caps keep the JSON file small (< 10 KB) so atomic rewrite stays fast.
MAX_SEEN_PATHS = 100
MAX_READ_PATHS = 100
MAX_EMITTED_INCS = 50


@dataclass
class LoopState:
    """Session-level state for the loop engine.

    `seen_paths_recent` is keyed by absolute file path; values are content
    hashes (currently empty strings — reserved for future fingerprinting so
    the loop engine can answer "have I already flagged this exact content?").

    `read_paths_recent` is a FIFO list — only the last MAX_READ_PATHS entries
    are kept, in arrival order.

    `emitted_incs_this_session` lets the loop engine dedupe a repeated INC
    within the same session — if the matcher keeps firing on the same INC
    id for the same event, we suppress the duplicate prompt.

    `ops_counter` is a simple monotonic counter incremented on every
    dispatch. It surfaces in `check.sh` audits so the loop engine's
    heartbeat can be verified without reading `events/`.
    """

    seen_paths_recent: dict[str, str] = field(default_factory=dict)
    read_paths_recent: list[str] = field(default_factory=list)
    emitted_incs_this_session: list[str] = field(default_factory=list)
    last_action_at: float = 0.0
    ops_counter: int = 0

    # -- persistence ------------------------------------------------------

    @classmethod
    def load_from_disk(cls) -> "LoopState":
        """Load from `STATE_PATH`. Returns an empty state on any error."""
        if not STATE_PATH.exists():
            return cls()
        try:
            raw = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return cls()
        if not isinstance(raw, dict):
            return cls()
        return cls(
            seen_paths_recent={
                str(k): str(v)
                for k, v in (raw.get("seen_paths_recent") or {}).items()
            },
            read_paths_recent=[
                str(p) for p in (raw.get("read_paths_recent") or [])
            ],
            emitted_incs_this_session=[
                str(i) for i in (raw.get("emitted_incs_this_session") or [])
            ],
            last_action_at=float(raw.get("last_action_at") or 0.0),
            ops_counter=int(raw.get("ops_counter") or 0),
        )

    def save_to_disk(self) -> None:
        """Atomic temp+rename. Never blocks the caller on partial writes."""
        STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(
            prefix="state.", suffix=".json.tmp",
            dir=str(STATE_PATH.parent),
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(asdict(self), fh, ensure_ascii=False, indent=2)
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(tmp_path, STATE_PATH)
        except Exception:
            # Best-effort cleanup of the temp file on failure; re-raise so
            # callers can log if they care.
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise

    # -- mutators ---------------------------------------------------------

    def record_mutation(self, file_path: str, content_hash: str = "") -> None:
        if not file_path:
            return
        self.seen_paths_recent[file_path] = content_hash
        # Cap the dict at MAX_SEEN_PATHS; dict preserves insertion order in
        # Python 3.7+, so the oldest keys are the first ones to drop.
        if len(self.seen_paths_recent) > MAX_SEEN_PATHS:
            excess = len(self.seen_paths_recent) - MAX_SEEN_PATHS
            for k in list(self.seen_paths_recent.keys())[:excess]:
                del self.seen_paths_recent[k]
        self.ops_counter += 1
        self.last_action_at = time.time()

    def record_read(self, file_path: str) -> None:
        if not file_path:
            return
        self.read_paths_recent.append(file_path)
        if len(self.read_paths_recent) > MAX_READ_PATHS:
            self.read_paths_recent = self.read_paths_recent[-MAX_READ_PATHS:]
        self.ops_counter += 1
        self.last_action_at = time.time()

    def record_emit(self, inc_id: str) -> None:
        if not inc_id:
            return
        self.emitted_incs_this_session.append(inc_id)
        if len(self.emitted_incs_this_session) > MAX_EMITTED_INCS:
            self.emitted_incs_this_session = (
                self.emitted_incs_this_session[-MAX_EMITTED_INCS:]
            )

    def has_emitted(self, inc_id: str) -> bool:
        return inc_id in self.emitted_incs_this_session
