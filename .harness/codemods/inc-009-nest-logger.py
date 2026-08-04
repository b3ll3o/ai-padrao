#!/usr/bin/env python3
"""Codemod INC-009 — convert `console.log` / `console.warn` to Nest `Logger`.

In `apps/api/src/main.ts` (and any other NestJS entrypoint), `console.log`
trips the `no-console` lint rule, and `console.warn` writes to stderr (which
breaks log shippers). The proper fix is to use Nest's structured `Logger`
and `app.flushLogs()`, so the boot banner goes through the same logger as
the rest of the app.

Strategy:
    1. Add `import { Logger } from '@nestjs/common';` to the existing import
       block IF not already present.
    2. Replace `console.log('msg')` with `new Logger('Bootstrap').log('msg')`.
    3. Replace `console.warn('msg')` with `new Logger('Bootstrap').warn('msg')`.
    4. Replace `console.error('msg')` with `new Logger('Bootstrap').error('msg')`.

Default context name is `'Bootstrap'`. The user can run this codemod and
then rename the context per file.

Scope: only `apps/api/src/main.ts` (the file INC-009 references). *.spec.ts
are intentionally skipped because tests use `console.*` legitimately.

Usage:
    python3 inc-009-nest-logger.py --check <file>
    python3 inc-009-nest-logger.py --apply <file>

Exit codes:
    0  nothing to change (or already applied)
    1  file not found / read error
    2  --check found changes needed (and they were not applied)
"""

from __future__ import annotations

import argparse
import difflib
import pathlib
import re
import sys


_SCOPE_RE = re.compile(r"^apps/api/src/main\.ts$")


def _normalize(path: pathlib.Path) -> str:
    """Best-effort relative path for scope checks (see inc-002 for rationale)."""
    s = str(path).replace("\\", "/")
    try:
        return str(path.relative_to(pathlib.Path.cwd())).replace("\\", "/")
    except ValueError:
        return s


def _in_scope(path: pathlib.Path) -> bool:
    return bool(_SCOPE_RE.match(_normalize(path)))


def _ensure_logger_import(text: str) -> tuple[str, bool]:
    """Add `import { Logger } from '@nestjs/common';` if not present."""
    if re.search(r"from\s+['\"]@nestjs/common['\"]", text):
        # Already imports from @nestjs/common — check if Logger is in scope.
        if re.search(r"import\s*\{[^}]*\bLogger\b[^}]*\}\s*from\s*['\"]@nestjs/common['\"]", text):
            return text, False
        # Add Logger to the existing import group.
        text = re.sub(
            r"(import\s*\{)([^}]*)(\}\s*from\s*['\"]@nestjs/common['\"])",
            lambda m: (
                f"{m.group(1)}{m.group(2).rstrip()}, Logger{m.group(3)}"
                if m.group(2).strip()
                else f"import {{ Logger }}{m.group(3)}"
            ),
            text,
            count=1,
        )
        return text, True
    # Add a new import line at the top.
    return "import { Logger } from '@nestjs/common';\n" + text, True


def _rewrite(text: str) -> tuple[str, list[str]]:
    descriptions: list[str] = []

    new_text, added = _ensure_logger_import(text)
    if added:
        descriptions.append("added `import { Logger } from '@nestjs/common'`")

    patterns = [
        (re.compile(r"\bconsole\.log\(\s*"), "new Logger('Bootstrap').log(", "console.log → Logger.log"),
        (re.compile(r"\bconsole\.warn\(\s*"), "new Logger('Bootstrap').warn(", "console.warn → Logger.warn"),
        (re.compile(r"\bconsole\.error\(\s*"), "new Logger('Bootstrap').error(", "console.error → Logger.error"),
    ]
    for pat, repl, desc in patterns:
        new_text, n = pat.subn(repl, new_text)
        if n:
            descriptions.append(f"{desc} ({n}×)")

    return new_text, descriptions


def _print_diff(path: pathlib.Path, before: str, after: str) -> None:
    if before == after:
        return
    diff = difflib.unified_diff(
        before.splitlines(keepends=True),
        after.splitlines(keepends=True),
        fromfile=f"a/{path}",
        tofile=f"b/{path}",
    )
    sys.stdout.write("".join(diff))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=pathlib.Path)
    parser.add_argument("--check", action="store_true",
                        help="Dry-run: print proposed changes, exit 2 if any.")
    parser.add_argument("--apply", action="store_true",
                        help="Apply the rewrite in place.")
    args = parser.parse_args()

    if not args.path.exists():
        print(f"inc-009: file not found: {args.path}", file=sys.stderr)
        return 1

    if not args.check and not args.apply:
        print("inc-009: must specify --check or --apply", file=sys.stderr)
        return 1

    if not _in_scope(args.path):
        return 0

    original = args.path.read_text()
    rewritten, descriptions = _rewrite(original)

    if original == rewritten:
        return 0

    if args.check:
        _print_diff(args.path, original, rewritten)
        for d in descriptions:
            print(f"  proposed: {d}", file=sys.stderr)
        print(
            f"inc-009: {args.path} needs changes. Re-run with --apply.",
            file=sys.stderr,
        )
        return 2

    args.path.write_text(rewritten)
    for d in descriptions:
        print(f"  applied: {d}", file=sys.stderr)
    print(f"inc-009: applied {args.path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
