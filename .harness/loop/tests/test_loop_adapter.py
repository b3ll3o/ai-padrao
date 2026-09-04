"""White-box tests for `.harness/loop/run.py` and `.harness/loop/state.py`.

Follows the precedent of `test_pattern_match.py`: replaces stdin/stdout,
calls `loop.run.main()` directly, asserts on captured outputs and the
state file. No subprocess overhead.

The fixtures reuse the trigger-token trick (runtime-joined strings) so
the test source itself doesn't carry contiguous INC-002 / INC-012
trigger tokens (which would self-fire on every Read of this file).
"""

from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Make the harness root + the loop package importable.
_HERE = Path(__file__).resolve().parent
_HARNESS = _HERE.parent.parent
sys.path.insert(0, str(_HARNESS))

import loop.run as loop_run  # noqa: E402
import loop.state as loop_state  # noqa: E402


# ---------------------------------------------------------------------------
# Trigger-token construction (runtime, not source-literal)
# ---------------------------------------------------------------------------
_INC012_PATH = "apps" + "/" + "api" + "/" + "src"
_INC012_GLOB = _INC012_PATH + "/" + "**" + "/" + "*" + ".spec" + "." + "ts"


# ---------------------------------------------------------------------------
# Fixture builders
# ---------------------------------------------------------------------------
def _spec_write_event(idx: int, body: str) -> dict:
    """A Write event on `apps/api/src/foo<N>.spec.ts` carrying a `test.skip(...)` body."""
    path = _INC012_PATH + "/" + "foo{}".format(idx) + "." + "spec" + "." + "ts"
    return {
        "tool_name": "Write",
        "file_path": path,
        "description": body[:60],
        "tool_input": {"file_path": path, "content": body},
    }


def _noise_read_event(idx: int) -> dict:
    return {"tool_name": "Read", "file_path": "README.md"}


def _edit_event(path: str) -> dict:
    return {
        "tool_name": "Edit",
        "file_path": path,
        "tool_input": {"file_path": path, "old_string": "a", "new_string": "b"},
    }


def _bash_event(command: str) -> dict:
    return {
        "tool_name": "Bash",
        "tool_input": {"command": command, "description": "test"},
    }


# ---------------------------------------------------------------------------
# Test harness: redirect stdin/stdout, drive `main()`, capture results
# ---------------------------------------------------------------------------
def _drive(
    payload: dict,
    env_l2: str | None = "1",
    state_dir: Path | None = None,
) -> tuple[int, str, str]:
    """Run `loop.run.main()` with `payload` on stdin and the given L2 flag.

    Returns (rc, stdout, stderr). The state file is patched to a temp path
    so we never touch the real `.harness/loop/state.json`.

    `state_dir` lets multi-call tests share a persistent state location;
    default is a fresh TemporaryDirectory (wiped on exit).
    """
    saved_in, saved_out, saved_err = sys.stdin, sys.stdout, sys.stderr
    saved_env = os.environ.get("HARNESS_L2_ENABLED")
    if env_l2 is None:
        os.environ.pop("HARNESS_L2_ENABLED", None)
    else:
        os.environ["HARNESS_L2_ENABLED"] = env_l2

    cleanup = False
    if state_dir is None:
        state_dir = Path(tempfile.mkdtemp(prefix="loop-state-"))
        cleanup = True
    tmp_state = state_dir / "state.json"
    with patch.object(loop_state, "STATE_PATH", tmp_state):
        try:
            sys.stdin = io.StringIO(json.dumps(payload))
            sys.stdout = io.StringIO()
            sys.stderr = io.StringIO()
            rc = loop_run.main()
            out = sys.stdout.getvalue()
            err = sys.stderr.getvalue()
        finally:
            sys.stdin, sys.stdout, sys.stderr = saved_in, saved_out, saved_err
            if saved_env is None:
                os.environ.pop("HARNESS_L2_ENABLED", None)
            else:
                os.environ["HARNESS_L2_ENABLED"] = saved_env
            if cleanup:
                import shutil
                shutil.rmtree(state_dir, ignore_errors=True)
    return rc, out, err


# ---------------------------------------------------------------------------
# State persistence
# ---------------------------------------------------------------------------
class LoopStatePersistence(unittest.TestCase):
    """Atomic temp+rename survives a normal save/load roundtrip."""

    def test_roundtrip_preserves_all_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_state = Path(tmp) / "state.json"
            with patch.object(loop_state, "STATE_PATH", tmp_state):
                s = loop_state.LoopState()
                s.record_mutation("/x/foo.ts", "abc")
                s.record_read("/y/bar.ts")
                s.record_read("/y/baz.ts")
                s.record_emit("INC-012")
                s.ops_counter = 7
                s.save_to_disk()
                self.assertTrue(tmp_state.exists(), "state.json must exist after save")
                # File should not contain the *.tmp suffix — rename happened.
                leftovers = list(Path(tmp).glob("*.json.tmp"))
                self.assertEqual(leftovers, [], "no temp leftovers after rename")

                loaded = loop_state.LoopState.load_from_disk()
                self.assertEqual(loaded.ops_counter, 7)
                self.assertEqual(
                    loaded.seen_paths_recent, {"/x/foo.ts": "abc"}
                )
                self.assertEqual(
                    loaded.read_paths_recent, ["/y/bar.ts", "/y/baz.ts"]
                )
                self.assertEqual(
                    loaded.emitted_incs_this_session, ["INC-012"]
                )

    def test_load_missing_returns_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_state = Path(tmp) / "state.json"
            with patch.object(loop_state, "STATE_PATH", tmp_state):
                loaded = loop_state.LoopState.load_from_disk()
                self.assertEqual(loaded.ops_counter, 0)
                self.assertEqual(loaded.seen_paths_recent, {})

    def test_load_corrupt_returns_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_state = Path(tmp) / "state.json"
            tmp_state.write_text("this is not json {{{")
            with patch.object(loop_state, "STATE_PATH", tmp_state):
                loaded = loop_state.LoopState.load_from_disk()
                self.assertEqual(loaded.ops_counter, 0)

    def test_seen_paths_capped_at_max(self):
        s = loop_state.LoopState()
        for i in range(loop_state.MAX_SEEN_PATHS + 50):
            s.record_mutation("/x/file-{}.ts".format(i), "")
        self.assertEqual(len(s.seen_paths_recent), loop_state.MAX_SEEN_PATHS)
        # The most recent insertions must be retained.
        last_key = "/x/file-{}.ts".format(loop_state.MAX_SEEN_PATHS + 50 - 1)
        self.assertIn(last_key, s.seen_paths_recent)


# ---------------------------------------------------------------------------
# Loop engine dispatch
# ---------------------------------------------------------------------------
class LoopAdapterDispatch(unittest.TestCase):
    """Typed handlers route by tool_name; L2 disabled is a global opt-out."""

    def test_read_event_records_path_no_match(self):
        # Read shouldn't trigger the matcher at all (INC-018). We send a
        # payload whose `file_path` doesn't exist in any INC entry — the
        # important assertion is that exit code is 0.
        rc, out, err = _drive(
            {"tool_name": "Read", "file_path": "README.md"},
        )
        self.assertEqual(rc, 0, f"unexpected non-zero exit; stderr={err!r}")
        self.assertEqual(out, "")
        self.assertEqual(err, "")

    def test_l2_disabled_short_circuits(self):
        """HARNESS_L2_ENABLED=0 makes even a would-match event exit 0."""
        body = "describe('foo', () => { it.skip('todo', () => {}); });"
        window = [_spec_write_event(i, body) for i in range(2)]
        window.extend(_noise_read_event(i) for i in range(17))
        edit = _edit_event(_INC012_PATH + "/" + "foo99.spec" + "." + "ts")
        window.append(edit)
        # Stub out `_load_recent_events` so we don't depend on the real
        # events file; instead feed the matcher our synthetic window.
        with patch.object(loop_run, "_load_recent_events", return_value=window[:-1]):
            rc, out, err = _drive(
                edit,
                env_l2="0",
            )
        self.assertEqual(rc, 0, "L2 disabled must short-circuit before matcher")
        self.assertEqual(err, "")

    def test_eslint_bash_event_excluded_by_inc029(self):
        """INC-029 (forwarded): a Bash event running eslint must NOT emit
        INC-012 even when its command text quotes a *.spec.ts path."""
        # 19 noise + 1 lint bash; no spec Writes in the window at all.
        recent: list[dict] = [_noise_read_event(i) for i in range(19)]
        recent.append(_bash_event("pnpm exec eslint apps/api/src/foo.spec.ts"))
        edit = _edit_event(_INC012_PATH + "/" + "foo0.spec" + "." + "ts")
        with patch.object(loop_run, "_load_recent_events", return_value=recent[:-1]):
            rc, out, err = _drive(edit)
        self.assertEqual(rc, 0, f"unexpected non-zero; stderr={err!r}")
        self.assertEqual(err, "")

    def test_edit_with_skip_literal_emits_inc012(self):
        """Canonical case: Edit on a spec file carrying test.skip -> INC-012."""
        body = "describe('foo', () => { it.skip('todo', () => {}); });"
        recent = [_spec_write_event(i, body) for i in range(2)]
        recent.extend(_noise_read_event(i) for i in range(17))
        edit = _edit_event(_INC012_PATH + "/" + "foo99.spec" + "." + "ts")
        with patch.object(loop_run, "_load_recent_events", return_value=recent):
            rc, out, err = _drive(edit)
        self.assertEqual(rc, 2, f"expected exit 2 for INC-012; stderr={err!r}")
        self.assertIn("INC-012", err)

    def test_state_persists_across_calls(self):
        """First call records a mutation; second call reads it back."""
        with tempfile.TemporaryDirectory() as tmp:
            state_dir = Path(tmp)
            tmp_state = state_dir / "state.json"
            with patch.object(loop_state, "STATE_PATH", tmp_state), \
                 patch.object(loop_run, "_load_recent_events", return_value=[]):
                rc1, _, _ = _drive(
                    _edit_event(_INC012_PATH + "/" + "foo1.spec" + "." + "ts"),
                    state_dir=state_dir,
                )
                self.assertEqual(rc1, 0)
                self.assertTrue(
                    tmp_state.exists(),
                    "state.json written",
                )

                loaded = loop_state.LoopState.load_from_disk()
                self.assertEqual(loaded.ops_counter, 1)
                self.assertIn(
                    _INC012_PATH + "/" + "foo1.spec" + "." + "ts",
                    loaded.seen_paths_recent,
                )


# ---------------------------------------------------------------------------
# Pure-function smoke tests for the typed handlers themselves
# ---------------------------------------------------------------------------
class LoopAdapterHandlers(unittest.TestCase):
    """The four handlers route by tool_name; non-mutation events skip the matcher."""

    def test_handle_read_returns_empty_and_records(self):
        s = loop_state.LoopState()
        ev = {"tool_name": "Read", "file_path": "x.ts"}
        rc_id = loop_run._handle_read(ev, s)
        self.assertEqual(rc_id, "")
        self.assertEqual(s.read_paths_recent, ["x.ts"])

    def test_handle_other_skips_matcher(self):
        s = loop_state.LoopState()
        ev = {"tool_name": "TodoWrite", "tool_input": {"content": "x"}}
        rc_id = loop_run._handle_other(ev, s)
        self.assertEqual(rc_id, "")
        self.assertEqual(s.ops_counter, 1)


if __name__ == "__main__":
    unittest.main()
