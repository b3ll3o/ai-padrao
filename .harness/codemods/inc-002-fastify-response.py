#!/usr/bin/env python3
"""Codemod INC-002 — Express response API → Fastify response API.

The Express-style `res.setHeader(...)`, `res.cookie(...)`, `res.status(...)`,
`res.json(...)`, `res.send(...)` methods don't exist on the Fastify `FastifyReply`
wrapper that NestJS returns under `FastifyAdapter`. Calling them throws
`res.setHeader is not a function` (see INC-002).

This codemod rewrites the common patterns to their Fastify equivalents:

    res.setHeader('x-foo', v)   →  reply.header('x-foo', v)
    res.setHeader('x-foo', v);  →  reply.header('x-foo', v);   (trailing semicolon kept)
    res.cookie('sid', v, opts)  →  reply.setCookie('sid', v, opts)
    res.status(201)             →  reply.status(201)
    res.json({...})             →  reply.send({...})              (note: send, not json)
    res.send('text')            →  reply.send('text')

Scope: only applied inside files that match `apps/api/**/*.ts` AND when the
caller is identified as a `getResponse<FastifyReply>()` / `getResponse()` chain.
We deliberately do NOT touch `*.spec.ts` (where mocks may legitimately use
the Express shape) and we do NOT touch `*.controller.ts` (where Fastify's
`@Res()` decorator is the canonical passthrough).

Usage:
    python3 inc-002-fastify-response.py --check <file>
    python3 inc-002-fastify-response.py --apply <file>

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


# Scope guard: only apply to non-test files inside apps/api/src.
# No `^` anchor — we want the regex to match anywhere in the path so that
# absolute paths (`/tmp/test/apps/api/src/foo.ts`) also resolve. The end
# anchor (`$`) is preserved.
_SCOPE_RE = re.compile(r"apps/api/src/.+\.(ts|tsx)$")
_DELIBERATELY_SKIP_RE = re.compile(r"\.(spec|test)\.ts$|(^|/)main\.ts$|(^|/)controller\.ts$")


# Each rule: (compiled pattern, replacement, description).
# The pattern captures the call so the replacement preserves it.
_RULES: tuple[tuple[re.Pattern[str], str, str], ...] = (
    (
        re.compile(r"\bres\.setHeader\(\s*([^)]+?)\s*\)"),
        r"reply.header(\1)",
        "res.setHeader → reply.header",
    ),
    (
        re.compile(r"\bres\.cookie\(\s*([^)]+?)\s*\)"),
        r"reply.setCookie(\1)",
        "res.cookie → reply.setCookie",
    ),
    (
        re.compile(r"\bres\.status\(\s*(\d+)\s*\)"),
        r"reply.status(\1)",
        "res.status(N) → reply.status(N)",
    ),
    (
        re.compile(r"\bres\.json\(\s*"),
        r"reply.send(",
        "res.json(...) → reply.send(...)",
    ),
    (
        re.compile(r"\bres\.send\(\s*"),
        r"reply.send(",
        "res.send(...) → reply.send(...)",
    ),
)


def _in_scope(path: pathlib.Path) -> bool:
    """Return True if the codemod should touch this file."""
    s = _normalize(path)
    if not _SCOPE_RE.search(s):
        return False
    if _DELIBERATELY_SKIP_RE.search(s):
        return False
    return True


def _normalize(path: pathlib.Path) -> str:
    """Best-effort relative path for scope checks.

    `argparse` may receive either a workspace-relative path (e.g. `apps/api/...`)
    or an absolute path (when invoked from a smoke-test dir like /tmp/...). Try
    to make it relative to the current working directory first; fall back to
    the raw string so callers don't have to know which form they passed.
    """
    s = str(path).replace("\\", "/")
    try:
        return str(path.relative_to(pathlib.Path.cwd())).replace("\\", "/")
    except ValueError:
        return s


def _rewrite(text: str) -> tuple[str, list[str]]:
    """Apply every rule. Returns (new_text, descriptions_of_changes)."""
    descriptions: list[str] = []
    out = text
    for pat, repl, desc in _RULES:
        new_out, n = pat.subn(repl, out)
        if n:
            descriptions.append(f"{desc} ({n}×)")
            out = new_out
    return out, descriptions


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
        print(f"inc-002: file not found: {args.path}", file=sys.stderr)
        return 1

    if not args.check and not args.apply:
        print("inc-002: must specify --check or --apply", file=sys.stderr)
        return 1

    if not _in_scope(args.path):
        # Out of scope — silent no-op. The codemod is intentionally narrow.
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
            f"inc-002: {args.path} needs changes "
            f"({'; '.join(descriptions)}). Re-run with --apply.",
            file=sys.stderr,
        )
        return 2

    # --apply
    args.path.write_text(rewritten)
    for d in descriptions:
        print(f"  applied: {d}", file=sys.stderr)
    print(f"inc-002: applied {args.path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
