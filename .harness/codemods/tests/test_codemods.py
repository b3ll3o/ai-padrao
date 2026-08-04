#!/usr/bin/env python3
"""Unit tests for the harness codemods.

Each test invokes a codemod's `main()` directly with an argparse-style argv
list against a temp file. We exercise the three exit-code contracts:

  0 — file is already in the good form (no rewrite needed) OR --apply succeeded
  1 — usage / file-not-found error
  2 — --check found changes needed (and they were not applied)

Run: `python3 .harness/codemods/tests/test_codemods.py`

Stdlib-only.
"""

from __future__ import annotations

import os
import pathlib
import subprocess
import sys
import tempfile
import unittest


HERE = pathlib.Path(__file__).resolve().parent
CODEMODS = HERE.parent


def _run_codemod(script: pathlib.Path, *argv: str) -> subprocess.CompletedProcess:
    """Invoke a codemod as a subprocess and return the result."""
    return subprocess.run(
        [sys.executable, str(script), *argv],
        capture_output=True,
        text=True,
        timeout=10,
    )


def _write_temp(relative_path: str, content: str) -> pathlib.Path:
    """Create a temp file at <tmpdir>/<relative_path> with the given content.

    The relative_path must match what each codemod's scope regex expects
    (e.g. `apps/api/src/main.ts` for inc-009).
    """
    base = tempfile.mkdtemp(prefix="codemod-test-")
    path = pathlib.Path(base) / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    return path


class TestInc002FastifyResponse(unittest.TestCase):
    SCRIPT = CODEMODS / "inc-002-fastify-response.py"

    def test_skip_when_already_in_fastify_form(self):
        path = _write_temp(
            "apps/api/src/audit/foo.ts",
            "reply.header('x-foo', 'bar');\n",
        )
        result = _run_codemod(self.SCRIPT, "--check", str(path))
        self.assertEqual(result.returncode, 0, msg=result.stderr)

    def test_skip_when_out_of_scope(self):
        path = _write_temp(
            "apps/web/src/main.ts",
            "res.setHeader('x-foo', 'bar');\n",
        )
        result = _run_codemod(self.SCRIPT, "--check", str(path))
        self.assertEqual(result.returncode, 0, msg=result.stderr)

    def test_check_detects_res_setHeader(self):
        path = _write_temp(
            "apps/api/src/audit/foo.ts",
            "res.setHeader('x-foo', 'bar');\n",
        )
        result = _run_codemod(self.SCRIPT, "--check", str(path))
        self.assertEqual(result.returncode, 2, msg=result.stderr)
        self.assertIn("reply.header", result.stdout)

    def test_check_detects_res_json(self):
        path = _write_temp(
            "apps/api/src/audit/foo.ts",
            "res.json({ ok: true });\n",
        )
        result = _run_codemod(self.SCRIPT, "--check", str(path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("reply.send", result.stdout)

    def test_skip_when_in_skip_pattern(self):
        # *.spec.ts and main.ts are deliberately skipped by the codemod.
        path = _write_temp(
            "apps/api/src/foo.spec.ts",
            "res.setHeader('x-foo', 'bar');\n",
        )
        result = _run_codemod(self.SCRIPT, "--check", str(path))
        self.assertEqual(result.returncode, 0)


class TestInc003NestDiImports(unittest.TestCase):
    SCRIPT = CODEMODS / "inc-003-nest-di-imports.py"

    def test_no_di_identifiers_is_noop(self):
        path = _write_temp(
            "apps/api/src/auth/foo.ts",
            "import type { Foo } from './foo';\nconst x: Foo = {} as Foo;\n",
        )
        result = _run_codemod(self.SCRIPT, "--check", str(path))
        self.assertEqual(result.returncode, 0)

    def test_di_identifier_in_constructor_triggers_rewrite(self):
        path = _write_temp(
            "apps/api/src/auth/foo.ts",
            (
                "import type { FooService } from './foo.service';\n"
                "class A {\n"
                "  constructor(private readonly foo: FooService) {}\n"
                "}\n"
            ),
        )
        result = _run_codemod(self.SCRIPT, "--check", str(path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("converted", result.stderr)

    def test_out_of_scope_is_noop(self):
        path = _write_temp(
            "apps/web/src/foo.ts",
            (
                "import type { FooService } from './foo.service';\n"
                "class A {\n"
                "  constructor(private foo: FooService) {}\n"
                "}\n"
            ),
        )
        result = _run_codemod(self.SCRIPT, "--check", str(path))
        self.assertEqual(result.returncode, 0)


class TestInc006DockerfileOrder(unittest.TestCase):
    SCRIPT = CODEMODS / "inc-006-dockerfile-order.py"

    GOOD_DOCKERFILE = (
        "FROM node:22\n"
        "COPY apps/api/prisma ./apps/api/prisma\n"
        "RUN pnpm exec prisma generate\n"
    )

    BAD_DOCKERFILE = (
        "FROM node:22\n"
        "RUN pnpm exec prisma generate\n"
        "COPY apps/api/prisma ./apps/api/prisma\n"
    )

    def test_in_scope_dev_no_changes_needed(self):
        path = _write_temp("apps/api/Dockerfile.dev", self.GOOD_DOCKERFILE)
        result = _run_codemod(self.SCRIPT, "--check", str(path))
        self.assertEqual(result.returncode, 0)

    def test_out_of_scope(self):
        path = _write_temp("apps/api/src/main.ts", self.GOOD_DOCKERFILE)
        result = _run_codemod(self.SCRIPT, "--check", str(path))
        self.assertEqual(result.returncode, 0)

    def test_check_detects_misordered_copy(self):
        path = _write_temp("apps/api/Dockerfile.prod", self.BAD_DOCKERFILE)
        result = _run_codemod(self.SCRIPT, "--check", str(path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("moved schema COPY", result.stderr)

    def test_apply_rewrites_in_place(self):
        path = _write_temp("apps/api/Dockerfile.prod", self.BAD_DOCKERFILE)
        result = _run_codemod(self.SCRIPT, "--apply", str(path))
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        rewritten = path.read_text()
        # The COPY must now appear before the prisma generate RUN.
        self.assertLess(
            rewritten.index("COPY apps/api/prisma"),
            rewritten.index("prisma generate"),
        )


class TestInc009NestLogger(unittest.TestCase):
    SCRIPT = CODEMODS / "inc-009-nest-logger.py"

    def test_no_console_is_noop(self):
        path = _write_temp(
            "apps/api/src/main.ts",
            "import { NestFactory } from '@nestjs/core';\n",
        )
        result = _run_codemod(self.SCRIPT, "--check", str(path))
        self.assertEqual(result.returncode, 0)

    def test_out_of_scope(self):
        path = _write_temp(
            "apps/api/src/audit/foo.ts",
            "console.log('hi');\n",
        )
        result = _run_codemod(self.SCRIPT, "--check", str(path))
        self.assertEqual(result.returncode, 0)

    def test_check_detects_console_log(self):
        path = _write_temp(
            "apps/api/src/main.ts",
            (
                "async function bootstrap() {\n"
                "  console.log('Starting');\n"
                "  console.warn('Warning');\n"
                "}\n"
            ),
        )
        result = _run_codemod(self.SCRIPT, "--check", str(path))
        self.assertEqual(result.returncode, 2)
        self.assertIn("Logger", result.stdout)


class TestRunShWrapper(unittest.TestCase):
    """The wrapper at run.sh must forward `<files...> --check|--apply` correctly."""

    def test_wrapper_check_on_good_file_exits_0(self):
        path = _write_temp("apps/api/src/main.ts", "const x = 1;\n")
        result = subprocess.run(
            [str(CODEMODS / "run.sh"), "inc-009-nest-logger", "--check", str(path)],
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)