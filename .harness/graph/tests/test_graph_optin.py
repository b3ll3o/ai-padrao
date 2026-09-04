"""White-box tests for `.harness/graph/run.py` — opt-in flag + I/O wiring.

The walk function itself is pure and covered by `test_graph_walk.py`.
This file covers the I/O layer: stdin parsing, HARNESS_L2_ENABLED +
HARNESS_GRAPH_ENABLED short-circuits, mutation filter, and stderr
announcement on would-change.
"""

from __future__ import annotations

import io
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

_HERE = Path(__file__).resolve().parent
_HARNESS = _HERE.parent.parent
sys.path.insert(0, str(_HARNESS))

import graph.run as graph_run  # noqa: E402


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------
_INC002_PATH = "apps" + "/" + "api" + "/" + "src"
_INC002_FILE = _INC002_PATH + "/" + "modules" + "/" + "foo" + "." + "ts"


def _drive(payload: dict, env_graph: str | None = "0") -> tuple[int, str, str]:
    """Run `graph.run.main()` with `payload` on stdin. Returns (rc, out, err).

    HARNESS_L2_ENABLED is pinned to "1" (on) so the graph engine's L2
    short-circuit doesn't pre-empt the test. HARNESS_GRAPH_ENABLED is
    driven by `env_graph` — "0" / None / "false" disables the engine.
    """
    saved_in, saved_out, saved_err = sys.stdin, sys.stdout, sys.stderr
    saved_l2 = os.environ.get("HARNESS_L2_ENABLED")
    saved_gr = os.environ.get("HARNESS_GRAPH_ENABLED")
    os.environ["HARNESS_L2_ENABLED"] = "1"
    if env_graph is None:
        os.environ.pop("HARNESS_GRAPH_ENABLED", None)
    else:
        os.environ["HARNESS_GRAPH_ENABLED"] = env_graph
    try:
        sys.stdin = io.StringIO(json.dumps(payload))
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()
        rc = graph_run.main()
        out = sys.stdout.getvalue()
        err = sys.stderr.getvalue()
    finally:
        sys.stdin, sys.stdout, sys.stderr = saved_in, saved_out, saved_err
        if saved_l2 is None:
            os.environ.pop("HARNESS_L2_ENABLED", None)
        else:
            os.environ["HARNESS_L2_ENABLED"] = saved_l2
        if saved_gr is None:
            os.environ.pop("HARNESS_GRAPH_ENABLED", None)
        else:
            os.environ["HARNESS_GRAPH_ENABLED"] = saved_gr
    return rc, out, err


# ---------------------------------------------------------------------------
# Opt-in flag
# ---------------------------------------------------------------------------
class TestGraphOptIn(unittest.TestCase):
    def test_graph_disabled_default_returns_zero(self):
        """No HARNESS_GRAPH_ENABLED set → engine silent, exit 0."""
        # Even a would-trigger event stays silent.
        payload = {"tool_name": "Edit", "file_path": _INC002_FILE}
        rc, out, err = _drive(payload, env_graph=None)
        self.assertEqual(rc, 0)
        self.assertEqual(out, "")
        self.assertEqual(err, "")

    def test_graph_disabled_zero_returns_zero(self):
        """HARNESS_GRAPH_ENABLED=0 → engine silent."""
        payload = {"tool_name": "Edit", "file_path": _INC002_FILE}
        rc, out, err = _drive(payload, env_graph="0")
        self.assertEqual(rc, 0)
        self.assertEqual(err, "")

    def test_graph_disabled_false_returns_zero(self):
        """HARNESS_GRAPH_ENABLED=false → engine silent."""
        payload = {"tool_name": "Edit", "file_path": _INC002_FILE}
        rc, out, err = _drive(payload, env_graph="false")
        self.assertEqual(rc, 0)
        self.assertEqual(err, "")


# ---------------------------------------------------------------------------
# Non-mutation events + L2 short-circuit
# ---------------------------------------------------------------------------
class TestGraphShortCircuits(unittest.TestCase):
    def test_bash_event_skipped(self):
        payload = {"tool_name": "Bash", "tool_input": {"command": "ls"}}
        rc, out, err = _drive(payload, env_graph="1")
        self.assertEqual(rc, 0)
        self.assertEqual(err, "")

    def test_read_event_skipped(self):
        payload = {"tool_name": "Read", "file_path": "README.md"}
        rc, out, err = _drive(payload, env_graph="1")
        self.assertEqual(rc, 0)
        self.assertEqual(err, "")

    def test_l2_disabled_skips_graph(self):
        """HARNESS_L2_ENABLED=0 also turns off the graph engine."""
        saved_l2 = os.environ.get("HARNESS_L2_ENABLED")
        os.environ["HARNESS_L2_ENABLED"] = "0"
        os.environ["HARNESS_GRAPH_ENABLED"] = "1"
        try:
            saved_in, saved_out, saved_err = sys.stdin, sys.stdout, sys.stderr
            try:
                sys.stdin = io.StringIO(json.dumps({
                    "tool_name": "Edit", "file_path": _INC002_FILE,
                }))
                sys.stdout = io.StringIO()
                sys.stderr = io.StringIO()
                rc = graph_run.main()
                err = sys.stderr.getvalue()
            finally:
                sys.stdin, sys.stdout, sys.stderr = saved_in, saved_out, saved_err
        finally:
            if saved_l2 is None:
                os.environ.pop("HARNESS_L2_ENABLED", None)
            else:
                os.environ["HARNESS_L2_ENABLED"] = saved_l2
            os.environ.pop("HARNESS_GRAPH_ENABLED", None)
        self.assertEqual(rc, 0)
        self.assertEqual(err, "")


# ---------------------------------------------------------------------------
# Walk + codemod subprocess integration (with a stubbed subprocess)
# ---------------------------------------------------------------------------
class TestGraphCodemodIntegration(unittest.TestCase):
    """When HARNESS_GRAPH_ENABLED=1 and a mutation matches, run codemod --check."""

    def test_match_runs_codemod_emits_stderr_on_would_change(self):
        """A mutation matching INC-002's glob invokes its codemod; if the
        codemod exits 2 (would-change), stderr carries the announcement
        and the hook returns exit 2."""

        def fake_run_codemod(codemod_path, file_path):
            # Simulate "would change" by returning exit 2.
            return 2, "would rewrite 3 patterns"

        payload = {"tool_name": "Edit", "file_path": _INC002_FILE}
        with patch.object(graph_run, "_run_codemod_check", side_effect=fake_run_codemod):
            rc, out, err = _drive(payload, env_graph="1")
        self.assertEqual(rc, 2, "expected exit 2 for would-change")
        self.assertIn("harness-graph:", err)
        self.assertIn("INC-002", err)
        self.assertIn(_INC002_FILE, err)

    def test_match_no_change_returns_zero(self):
        """When the codemod exits 0 (file already in safe form), the
        engine exits 0 even though the INC matched."""

        def fake_run_codemod(codemod_path, file_path):
            return 0, ""

        payload = {"tool_name": "Edit", "file_path": _INC002_FILE}
        with patch.object(graph_run, "_run_codemod_check", side_effect=fake_run_codemod):
            rc, out, err = _drive(payload, env_graph="1")
        self.assertEqual(rc, 0)
        self.assertEqual(err, "")

    def test_no_matching_entry_returns_zero(self):
        """Edit on a path with no INC glob hit → engine exits 0."""
        payload = {
            "tool_name": "Edit",
            "file_path": "apps" + "/" + "web" + "/" + "src" + "/" + "x.ts",
        }
        with patch.object(graph_run, "_run_codemod_check") as fake:
            rc, out, err = _drive(payload, env_graph="1")
            fake.assert_not_called()
        self.assertEqual(rc, 0)


if __name__ == "__main__":
    unittest.main()
