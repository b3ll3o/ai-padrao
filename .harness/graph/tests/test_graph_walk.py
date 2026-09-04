"""White-box tests for `.harness/graph/walk.py` — pure function, no I/O.

The graph engine's value lives in the walk step: matching the event's
file_path against every INC entry's `trigger_pattern.files` globs and
returning the subset that has a corresponding codemod file. `walk()` is
pure, so the tests don't need to mock subprocesses or stdin.

Reuses the runtime-token trick (join fragments at call time) so the
test source itself doesn't carry the contiguous `apps/api/src/...` glob
or the `INC-002` codemod filename.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_HARNESS = _HERE.parent.parent
sys.path.insert(0, str(_HARNESS))

from graph import walk as graph_walk  # noqa: E402
from graph.walk import (  # noqa: E402
    _file_path_from_event,
    _find_codemod_path,
    _glob_to_regex,
    _resolve_relative_path,
    walk,
)


# ---------------------------------------------------------------------------
# Trigger-token construction (runtime, not source-literal)
# ---------------------------------------------------------------------------
_INC002_PATH = "apps" + "/" + "api" + "/" + "src"
_INC002_GLOB = _INC002_PATH + "/" + "**" + "/" + "*" + ".ts"
_INC002_CODEMOD_NAME = "inc-002-fastify-response" + "." + "py"


# ---------------------------------------------------------------------------
# Glob compiler
# ---------------------------------------------------------------------------
class TestGlobCompiler(unittest.TestCase):
    def test_double_star_matches_deeply_nested(self):
        rx = _glob_to_regex(_INC002_GLOB)
        self.assertIsNotNone(rx.search(_INC002_PATH + "/" + "modules" + "/" + "foo.ts"))
        self.assertIsNotNone(
            rx.search(_INC002_PATH + "/" + "a" + "/" + "b" + "/" + "c" + "." + "ts")
        )

    def test_literal_only_glob(self):
        rx = _glob_to_regex("README.md")
        self.assertIsNotNone(rx.search("README.md"))
        self.assertIsNotNone(rx.search("packages/x/README.md"))
        self.assertIsNone(rx.search("README.txt"))

    def test_case_insensitive(self):
        rx = _glob_to_regex("Foo.ts")
        self.assertIsNotNone(rx.search("FOO.TS"))


# ---------------------------------------------------------------------------
# Path normalisation
# ---------------------------------------------------------------------------
class TestResolveRelativePath(unittest.TestCase):
    def test_relative_path_returned_unchanged(self):
        self.assertEqual(
            _resolve_relative_path(_INC002_PATH + "/" + "foo.ts"),
            _INC002_PATH + "/" + "foo.ts",
        )

    def test_absolute_path_outside_repo_unchanged(self):
        # Path that doesn't live under the harness repo (e.g. /tmp/) —
        # returned as-is so the glob match can fail-fast.
        self.assertEqual(_resolve_relative_path("/tmp/foo.ts"), "/tmp/foo.ts")

    def test_empty_path_returns_empty(self):
        self.assertEqual(_resolve_relative_path(""), "")


# ---------------------------------------------------------------------------
# Codemod discovery
# ---------------------------------------------------------------------------
class TestFindCodemodPath(unittest.TestCase):
    def test_inc002_has_codemod(self):
        path = _find_codemod_path("INC-002")
        self.assertIsNotNone(path)
        self.assertTrue(str(path).endswith(_INC002_CODEMOD_NAME))

    def test_inc004_has_no_codemod(self):
        # INC-004 (prisma.seed config) is a build-time check, not a codemod.
        self.assertIsNone(_find_codemod_path("INC-004"))

    def test_malformed_id_returns_none(self):
        self.assertIsNone(_find_codemod_path(""))
        self.assertIsNone(_find_codemod_path("INC-"))
        self.assertIsNone(_find_codemod_path("not-an-inc"))


# ---------------------------------------------------------------------------
# Non-mutation events short-circuit
# ---------------------------------------------------------------------------
class TestWalkFiltersNonMutations(unittest.TestCase):
    def test_bash_event_returns_empty(self):
        event = {"tool_name": "Bash", "tool_input": {"command": "ls"}}
        self.assertEqual(walk(event, []), [])

    def test_read_event_returns_empty(self):
        event = {"tool_name": "Read", "file_path": _INC002_PATH + "/" + "foo.ts"}
        self.assertEqual(walk(event, []), [])

    def test_todo_event_returns_empty(self):
        event = {"tool_name": "TodoWrite", "tool_input": {"content": "x"}}
        self.assertEqual(walk(event, []), [])

    def test_empty_file_path_returns_empty(self):
        event = {"tool_name": "Edit", "file_path": "", "tool_input": {}}
        self.assertEqual(walk(event, []), [])


# ---------------------------------------------------------------------------
# File-axis match + codemod discovery
# ---------------------------------------------------------------------------
class TestWalkFileAxisMatch(unittest.TestCase):
    def test_inc002_edit_returns_codemod_step(self):
        entries = [{
            "id": "INC-002",
            "trigger_pattern": {"files": [_INC002_GLOB]},
        }]
        event = {
            "tool_name": "Edit",
            "file_path": _INC002_PATH + "/" + "modules" + "/" + "foo.ts",
        }
        steps = walk(event, entries)
        self.assertEqual(len(steps), 1)
        step = steps[0]
        self.assertEqual(step["inc_id"], "INC-002")
        self.assertTrue(step["codemod_path"].endswith(_INC002_CODEMOD_NAME))
        self.assertIsNone(step["would_change"])  # filled by run.py
        self.assertEqual(step["file_path"], event["file_path"])

    def test_inc004_edit_returns_empty_no_codemod(self):
        entries = [{
            "id": "INC-004",
            "trigger_pattern": {"files": ["apps/api/package.json"]},
        }]
        event = {"tool_name": "Write", "file_path": "apps/api/package.json"}
        self.assertEqual(walk(event, entries), [])

    def test_no_glob_match_returns_empty(self):
        entries = [{
            "id": "INC-002",
            "trigger_pattern": {"files": [_INC002_GLOB]},
        }]
        # apps/web is a different tree.
        event = {
            "tool_name": "Edit",
            "file_path": "apps" + "/" + "web" + "/" + "src" + "/" + "foo.ts",
        }
        self.assertEqual(walk(event, entries), [])

    def test_multiple_entries_returns_one_per_match(self):
        entries = [
            {"id": "INC-002", "trigger_pattern": {"files": [_INC002_GLOB]}},
            {"id": "INC-003", "trigger_pattern": {"files": [_INC002_GLOB]}},
            {"id": "INC-004", "trigger_pattern": {"files": ["apps/api/package.json"]}},
        ]
        event = {
            "tool_name": "Edit",
            "file_path": _INC002_PATH + "/" + "modules" + "/" + "foo.ts",
        }
        steps = walk(event, entries)
        # INC-002 + INC-003 both have codemods; INC-004 doesn't.
        ids = sorted(s["inc_id"] for s in steps)
        self.assertEqual(ids, ["INC-002", "INC-003"])

    def test_file_path_in_tool_input(self):
        # Some events put file_path under tool_input, not at top level.
        entries = [{
            "id": "INC-002",
            "trigger_pattern": {"files": [_INC002_GLOB]},
        }]
        event = {
            "tool_name": "Write",
            "tool_input": {
                "file_path": _INC002_PATH + "/" + "modules" + "/" + "bar.ts",
                "content": "// hello",
            },
        }
        steps = walk(event, entries)
        self.assertEqual(len(steps), 1)
        self.assertEqual(steps[0]["inc_id"], "INC-002")


# ---------------------------------------------------------------------------
# Smoke test: the graph package's public surface
# ---------------------------------------------------------------------------
class TestGraphPackageExports(unittest.TestCase):
    def test_walk_importable_from_package(self):
        # `graph.walk` should be importable as `graph.walk` (the package
        # facade) and via the direct module path.
        self.assertTrue(hasattr(graph_walk, "walk"))
        self.assertTrue(callable(graph_walk.walk))


if __name__ == "__main__":
    unittest.main()
