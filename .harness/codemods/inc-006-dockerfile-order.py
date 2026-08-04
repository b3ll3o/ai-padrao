#!/usr/bin/env python3
"""Codemod INC-006 — Dockerfile: ensure COPY of prisma schema precedes `prisma generate`.

`docker build` runs layers in order. If `RUN pnpm … prisma generate` runs before
the `COPY` that brings `apps/api/prisma/schema.prisma`, the build fails with
`Could not find Prisma Schema`. The fix is to ensure the COPY that brings the
schema (or its parent directory) appears earlier in the file than the
`prisma generate` RUN.

Strategy: locate the first `RUN … prisma generate` line and the first `COPY …`
line that brings either `apps/api/prisma` or `apps/api` (the schema is reachable
through both). If the COPY is later, move it (and any contiguous prerequisite
COPY/RUN pair) immediately before the generate RUN. We deliberately do NOT
reorder unrelated COPYs to keep the diff minimal.

Scope: only `apps/api/Dockerfile.dev` and `apps/api/Dockerfile.prod` (the two
files INC-006 references).

Usage:
    python3 inc-006-dockerfile-order.py --check <file>
    python3 inc-006-dockerfile-order.py --apply <file>

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


_SCOPE = ("apps/api/Dockerfile.dev", "apps/api/Dockerfile.prod")

_RUN_GENERATE_RE = re.compile(r"^\s*RUN\b.*prisma\s+generate\b", re.MULTILINE)
_COPY_SCHEMA_RE = re.compile(
    r"^\s*COPY\s+(apps/api/prisma|apps/api)\b",
    re.MULTILINE,
)


def _normalize(path: pathlib.Path) -> str:
    """Best-effort relative path for scope checks (see inc-002 for rationale)."""
    s = str(path).replace("\\", "/")
    try:
        return str(path.relative_to(pathlib.Path.cwd())).replace("\\", "/")
    except ValueError:
        return s


def _in_scope(path: pathlib.Path) -> bool:
    return _normalize(path) in _SCOPE


def _rewrite(text: str) -> tuple[str, list[str]]:
    """Move the schema COPY line(s) before the prisma generate RUN, if needed."""
    gen_match = _RUN_GENERATE_RE.search(text)
    if not gen_match:
        return text, []
    copy_match = _COPY_SCHEMA_RE.search(text)
    if not copy_match:
        return text, []
    if copy_match.start() < gen_match.start():
        return text, []

    # Extract the schema COPY line (and any immediately following COPY that's
    # still part of the "schema + package.json" pair).
    lines = text.splitlines(keepends=True)
    # Find line indices for the matches.
    line_starts: list[int] = []
    pos = 0
    for line in lines:
        line_starts.append(pos)
        pos += len(line)
    gen_line_idx = next(
        i for i, s in enumerate(line_starts) if s <= gen_match.start() < s + len(lines[i])
    )
    copy_line_idx = next(
        i for i, s in enumerate(line_starts) if s <= copy_match.start() < s + len(lines[i])
    )

    # Move the schema COPY block (the line itself) to immediately before
    # the generate RUN. We also pull the line that follows the COPY if it
    # looks like a package.json copy (common Dockerfile pattern).
    block_end = copy_line_idx + 1
    if (
        block_end < len(lines)
        and lines[block_end].lstrip().startswith("COPY")
        and "package.json" in lines[block_end]
    ):
        block_end += 1

    block = lines[copy_line_idx:block_end]
    remainder = lines[:copy_line_idx] + lines[block_end:]

    # Find the new index of `gen_line_idx` after the removal.
    new_gen_idx = gen_line_idx - len(block)
    if new_gen_idx < 0:
        new_gen_idx = 0

    new_lines = remainder[:new_gen_idx] + block + remainder[new_gen_idx:]
    new_text = "".join(new_lines)
    return new_text, ["moved schema COPY before `prisma generate` RUN"]


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
        print(f"inc-006: file not found: {args.path}", file=sys.stderr)
        return 1

    if not args.check and not args.apply:
        print("inc-006: must specify --check or --apply", file=sys.stderr)
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
            f"inc-006: {args.path} needs changes. Re-run with --apply.",
            file=sys.stderr,
        )
        return 2

    args.path.write_text(rewritten)
    for d in descriptions:
        print(f"  applied: {d}", file=sys.stderr)
    print(f"inc-006: applied {args.path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
