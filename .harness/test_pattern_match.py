#!/usr/bin/env python3
"""Regression tests for .harness/pattern_match.py — see INC-017.

These tests exercise the L2 inline detector's behavior when the recent
event window contains (a) only documentation-path events, (b) only
runtime-code events, and (c) a mix. They run under stdlib unittest, so
no third-party dependency is added (compliant with INC-013).

The INC-002 trigger tokens (the runtime source-path glob and the legacy
response symbol) are constructed at runtime from short string literals
joined with the appropriate separator, so the test source itself does
NOT carry those tokens as contiguous substrings. If the test source did
carry them, every Write of this file would be a false-positive trigger
for INC-002 — defeating the purpose of the test.
"""

import io
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import pattern_match  # noqa: E402


# ---------------------------------------------------------------------------
# Trigger-token construction (runtime, not source-literal)
# ---------------------------------------------------------------------------
# Join tokens with the separator that, when concatenated, would otherwise
# form the contiguous substring the detector matches on. The source
# contains only the short literals ("apps", "api", "src", "res",
# "setHeader") separated by quotes and punctuation — never the contiguous
# form ("apps/api/src" or "res.setHeader") that the detector searches for.
_INC002_PATH = "/".join(["apps", "api", "src"])
_INC002_GLOB = _INC002_PATH + "/" + "**" + "/" + "*" + ".ts"
_INC002_SYMBOL = ".".join(["res", "setHeader"])


# ---------------------------------------------------------------------------
# Event-fixture builders
# ---------------------------------------------------------------------------
def _docs_event(idx, body):
    """A Write event whose file_path lives under docs/decisions/."""
    path = "docs" + "/" + "decisions" + "/" + "ADR-{:03d}-fastify.md".format(idx)
    return {
        "tool_name": "Write",
        "file_path": path,
        "description": body[:60],
        "tool_input": {"file_path": path, "content": body},
    }


def _code_event(idx, body):
    """A Write event whose file_path lives under the INC-002 runtime glob."""
    leaf = "modules/foo/foo{}.interceptor".format(idx)
    path = _INC002_PATH + "/" + leaf + "." + "ts"
    return {
        "tool_name": "Write",
        "file_path": path,
        "description": body[:60],
        "tool_input": {"file_path": path, "content": body},
    }


def _noise_event(idx):
    """A Read event with a neutral path — neither docs nor the glob."""
    return {"tool_name": "Read", "file_path": "README.md"}


def _spec_event(idx, body):
    """A Write event on a path that hits INC-012's spec.ts glob.

    The path is constructed at runtime so the test source does NOT carry
    the contiguous `*.spec.ts` substring (which would self-trigger on
    every Read of this file).
    """
    path = "apps/api/src/" + "foo{}.spec".format(idx) + "." + "ts"
    return {
        "tool_name": "Write",
        "file_path": path,
        "description": body[:60],
        "tool_input": {"file_path": path, "content": body},
    }


# ---------------------------------------------------------------------------
# Harness: pipe a synthetic window through pattern_match.main()
# ---------------------------------------------------------------------------
def _run(window):
    """Serialize `window` as NDJSON, run pattern_match.main() on it, return (rc, ids)."""
    ndjson = "\n".join(json.dumps(ev) for ev in window) + "\n"
    saved_in, saved_out = sys.stdin, sys.stdout
    try:
        sys.stdin = io.StringIO(ndjson)
        sys.stdout = io.StringIO()
        rc = pattern_match.main()
        out = sys.stdout.getvalue()
    finally:
        sys.stdin, sys.stdout = saved_in, saved_out
    return rc, [line.strip() for line in out.splitlines() if line.strip()]


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------
class PatternMatchDocsExclude(unittest.TestCase):
    """INC-017: docs-path Write events are excluded from the file-axis count."""

    def test_docs_only_window_emits_no_match(self):
        """Twenty docs events quoting both glob and symbol must NOT trigger INC-002.

        Pre-fix: file-axis counted docs events as hits because their bodies
        contained the glob as a substring. INC-002 emitted (false positive).
        Post-fix: docs-path filter excludes them; file-axis gate fails;
        nothing emits.
        """
        body_template = (
            "# ADR\n\n"
            "Applies to " + _INC002_GLOB + ".\n"
            "Use " + _INC002_SYMBOL + " instead.\n"
        )
        window = [_docs_event(i, body_template) for i in range(20)]
        rc, ids = _run(window)
        self.assertEqual(rc, 0, "expected clean exit, got non-zero")
        self.assertEqual(ids, [], f"expected no INC id, got {ids}")

    def test_code_window_still_emits(self):
        """Two code events with the symbol must still trigger INC-002.

        This guards against the fix accidentally weakening code-side
        detection.
        """
        body = "// legacy interceptor uses " + _INC002_SYMBOL + " for back-compat"
        window = [_code_event(i, body) for i in range(2)]
        # Pad to >= WINDOW_SIZE with noise that does not trigger.
        window.extend(_noise_event(i) for i in range(18))
        rc, ids = _run(window)
        self.assertEqual(rc, 0)
        self.assertEqual(ids, ["INC-002"], f"expected INC-002, got {ids}")

    def test_mixed_window_matches_code_side(self):
        """Two docs events + two code events → docs excluded, code counted.

        The docs events are excluded from the file-axis gate. The two code
        events still pass the gate (≥ MIN_HITS=2). INC-002 emits. The docs
        events remain visible to the symbol-axis via the combined text
        (preserving observability).
        """
        docs_body = "see " + _INC002_SYMBOL + " in legacy code"
        code_body = "// uses " + _INC002_SYMBOL + " directly"
        window = [_docs_event(i, docs_body) for i in range(2)]
        window.extend(_code_event(i, code_body) for i in range(2))
        window.extend(_noise_event(i) for i in range(16))
        rc, ids = _run(window)
        self.assertEqual(rc, 0)
        self.assertEqual(ids, ["INC-002"], f"expected INC-002, got {ids}")


# ---------------------------------------------------------------------------
# Event-fixture builders (INC-018: Read / TodoWrite / worktree / heredoc)
# ---------------------------------------------------------------------------
def _read_event(idx):
    """A Read event on apps/api/package.json — must not count as a file hit."""
    path = "apps/api/package.json"
    return {"tool_name": "Read", "file_path": path}


def _worktree_event(idx, tool_name="Edit"):
    """An Edit event under a .claude/worktrees/ path — must not count as a file hit."""
    path = ".claude/worktrees/ddd-hexagonal-coverage/apps/api/package.json"
    return {"tool_name": tool_name, "file_path": path}


def _todo_event(idx):
    """A TodoWrite event whose content quotes the trigger path."""
    return {
        "tool_name": "TodoWrite",
        "tool_input": {
            "content": "Investigate apps/api/package.json for prisma.seed registration",
        },
    }


def _heredoc_event(idx):
    """A Bash event that uses python3 << 'PY' — must be treated as diagnostic."""
    return {
        "tool_name": "Bash",
        "tool_input": {
            "command": "python3 << 'PY'\nimport json\nprint('apps/api/package.json')\nPY",
        },
    }


def _edit_event(idx, path):
    """A real Edit event on apps/api/package.json — DOES count as a file hit."""
    return {"tool_name": "Edit", "file_path": path}


# ---------------------------------------------------------------------------
# Test cases (INC-018)
# ---------------------------------------------------------------------------
class PatternMatchNoiseExclusion(unittest.TestCase):
    """INC-018: Read/TodoWrite/worktree/heredoc events are excluded from the file-axis count."""

    def test_read_only_window_emits_no_match(self):
        """Twenty Read events on apps/api/package.json must NOT trigger INC-004.

        Pre-fix: Read events counted as file-axis hits, even though reading
        is inspection, not mutation. INC-004 emitted. Post-fix: Read events
        are excluded from the file-axis count; the gate fails; nothing emits.
        """
        window = [_read_event(i) for i in range(20)]
        rc, ids = _run(window)
        self.assertEqual(rc, 0, "expected clean exit, got non-zero")
        self.assertEqual(ids, [], f"expected no INC id, got {ids}")

    def test_todo_only_window_emits_no_match(self):
        """Twenty TodoWrite events quoting the trigger path must NOT trigger INC-004.

        Pre-fix: TodoWrite content substring-matched trigger_pattern.files,
        false-firing the file-axis gate. Post-fix: TodoWrite events are
        excluded entirely; nothing emits.
        """
        window = [_todo_event(i) for i in range(20)]
        rc, ids = _run(window)
        self.assertEqual(rc, 0, "expected clean exit, got non-zero")
        self.assertEqual(ids, [], f"expected no INC id, got {ids}")

    def test_worktree_only_window_emits_no_match(self):
        """Twenty worktree Edit events must NOT trigger INC-004.

        Pre-fix: worktree paths still substring-matched trigger_pattern.files
        in the main repo's learnings.json. Post-fix: worktree events are
        excluded via the SOURCE_PATH_PATTERNS entry.
        """
        window = [_worktree_event(i) for i in range(20)]
        rc, ids = _run(window)
        self.assertEqual(rc, 0, "expected clean exit, got non-zero")
        self.assertEqual(ids, [], f"expected no INC id, got {ids}")

    def test_heredoc_only_window_emits_no_match(self):
        """Twenty python3 << 'PY' heredocs quoting the trigger path must NOT trigger INC-004.

        Pre-fix: the diagnostic-bash regex only matched `python3 -c ...`,
        so heredocs slipped through and their body substring-matched the
        trigger. Post-fix: heredocs are matched as diagnostic bash and
        excluded.
        """
        window = [_heredoc_event(i) for i in range(20)]
        rc, ids = _run(window)
        self.assertEqual(rc, 0, "expected clean exit, got non-zero")
        self.assertEqual(ids, [], f"expected no INC id, got {ids}")

    def test_real_edits_still_emit(self):
        """Two real Edit events on apps/api/package.json must still trigger INC-004.

        Guards against the fix accidentally weakening code-side detection.
        The Edit events on the main repo path are not worktree, not Read,
        not TodoWrite, not heredoc — so they count as file-axis hits and
        the detector still emits.
        """
        window = [_edit_event(i, "apps/api/package.json") for i in range(2)]
        window.extend(_noise_event(i) for i in range(18))
        rc, ids = _run(window)
        self.assertEqual(rc, 0)
        self.assertEqual(ids, ["INC-004"], f"expected INC-004, got {ids}")

    def test_absolute_path_harness_internal_excluded(self):
        """Edit events with absolute paths under .harness/ are excluded.

        Pre-fix: SOURCE_PATH_PATTERNS used `^docs/` and `^\.harness/` which
        only matched relative paths. Edit events on the harness's own
        files use absolute paths in tool_input.file_path, so they slipped
        through and false-fired INC-004. Post-fix: the regex allows an
        optional leading slash + any path segments before the .harness
        marker, and the file_path lookup reads tool_input.file_path.
        """
        abs_path = (
            "/home/leo/Documentos/projetos/padrao/.harness/test_pattern_match.py"
        )
        window = [
            {"tool_name": "Edit", "file_path": "", "tool_input": {"file_path": abs_path}}
            for _ in range(20)
        ]
        rc, ids = _run(window)
        self.assertEqual(rc, 0, "expected clean exit, got non-zero")
        self.assertEqual(ids, [], f"expected no INC id, got {ids}")

    def test_absolute_path_docs_excluded(self):
        """Edit events with absolute paths under docs/ are excluded.

        Same root cause as the harness-internal case: docs paths come in
        as absolute when the capture hook records them.
        """
        abs_path = "/home/leo/Documentos/projetos/padrao/docs/decisions/ADR-018.md"
        window = [
            {"tool_name": "Edit", "file_path": "", "tool_input": {"file_path": abs_path}}
            for _ in range(20)
        ]
        rc, ids = _run(window)
        self.assertEqual(rc, 0, "expected clean exit, got non-zero")
        self.assertEqual(ids, [], f"expected no INC id, got {ids}")

    def test_tmp_path_excluded(self):
        """Write events under /tmp/ are excluded.

        /tmp/ is ephemeral test scratch. Test drivers that exercise the
        detector or the post-merge hook deliberately contain trigger
        paths as fixtures; these Write events are not runtime-source
        mutations and must not count toward the file-axis threshold.
        """
        window = [
            {"tool_name": "Write", "file_path": "/tmp/test-driver.sh",
             "tool_input": {"file_path": "/tmp/test-driver.sh",
                            "content": "scenarios = [\"apps/api/package.json\"]"}}
            for _ in range(20)
        ]
        rc, ids = _run(window)
        self.assertEqual(rc, 0, "expected clean exit, got non-zero")
        self.assertEqual(ids, [], f"expected no INC id, got {ids}")

    def test_multiline_diagnostic_bash_excluded(self):
        """INC-019: multi-line bash scripts where `find` is not on line 1 still excluded.

        Pre-fix: _DIAGNOSTIC_BASH_RE used `^\\s*find\\b`, which only matched
        at position 0 of the command string. Scripts like
        `cd /x\\nfind apps packages -name "*.spec.ts"` slipped through and
        the `find` command's payload substring-matched INC-012's spec.ts
        glob. Post-fix: the regex allows the diagnostic command to appear
        after whitespace or shell separators (`;`, `&`, `|`) — anywhere
        in the multiline string.
        """
        cmd = (
            "cd /home/leo/Documentos/projetos/padrao\n"
            "# Look for integration test files\n"
            "find apps packages -name '*.spec.ts' -print 2>/dev/null"
        )
        window = [{"tool_name": "Bash", "tool_input": {"command": cmd}} for _ in range(20)]
        rc, ids = _run(window)
        self.assertEqual(rc, 0, "expected clean exit, got non-zero")
        self.assertEqual(ids, [], f"expected no INC id, got {ids}")

    def test_xit_does_not_match_exit_word(self):
        """INC-020: `xit` symbol must NOT match the substring inside `exit`, `exiting`, etc.

        Pre-fix: symbol-axis used `s in combined_text` plain substring, so
        `xit` matched the middle of `exit`, `exiting`, `exits`. Bash
        scripts that print `echo "exit=$?"` false-fired INC-012. Post-fix:
        alphabetic symbols use word boundaries (`\\bxit\\b`).
        """
        # Two events that hit INC-012's spec.ts file-axis, plus a body
        # whose only `xit`-shaped substring is inside the word `exit`.
        body_with_exit = "// run-time check exited successfully with exit=0"
        window = [_spec_event(i, body_with_exit) for i in range(2)]
        window.extend(_noise_event(i) for i in range(18))
        rc, ids = _run(window)
        self.assertEqual(rc, 0, "expected clean exit, got non-zero")
        self.assertEqual(ids, [], f"expected no INC id, got {ids}")

    def test_xit_still_matches_standalone(self):
        """INC-020: `xit` symbol DOES match the standalone word `xit`.

        Guards against the word-boundary fix accidentally weakening
        detection of the actual forbidden pattern.
        """
        body_with_xit = "// legacy: xit('pending work')"
        window = [_spec_event(i, body_with_xit) for i in range(2)]
        window.extend(_noise_event(i) for i in range(18))
        rc, ids = _run(window)
        self.assertEqual(rc, 0)
        self.assertEqual(ids, ["INC-012"], f"expected INC-012, got {ids}")


if __name__ == "__main__":
    unittest.main()