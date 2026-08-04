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


if __name__ == "__main__":
    unittest.main()