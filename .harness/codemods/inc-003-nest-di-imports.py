#!/usr/bin/env python3
"""Codemod INC-003 — split `import type` for DI'd classes from pure type imports.

NestJS uses `emitDecoratorMetadata: true` to emit `design:paramtypes` at runtime.
This metadata references the imported VALUE (the class), not the type. When a
class imported via `import type {...}` is used in a DI'd context (constructor
parameter, `@Body()`, `@Query()`, `@Param()`, `@CurrentUser()`), the runtime
substitutes `Object` and the DI container can't resolve the provider.

The safe pattern is:

    import { PrismaService } from '../prisma/prisma.service';   // RUN-TIME value
    import type { SomeType } from '../types';                    // pure type

This codemod heuristically rewrites `import type { X, Y, Z } from '...'` so
that any identifier used in a constructor parameter OR a NestJS decorator
parameter (`@Body()`, `@Query()`, `@Param()`, `@CurrentUser()`, `@Inject(...)`)
becomes a regular `import { X }` line, while identifiers that appear only as
type annotations stay in `import type`.

Scope: only files under `apps/api/src/**` that are NOT `*.spec.ts` (tests may
mock with type-only imports intentionally).

Usage:
    python3 inc-003-nest-di-imports.py --check <file>
    python3 inc-003-nest-di-imports.py --apply <file>

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


_SCOPE_RE = re.compile(r"apps/api/src/.+\.ts$")
_SKIP_RE = re.compile(r"\.(spec|test)\.ts$")


# `import type { A, B as C, D } from 'mod';`
_IMPORT_TYPE_RE = re.compile(
    r"^import\s+type\s*\{\s*([^}]+)\s*\}\s*from\s*['\"]([^'\"]+)['\"]\s*;?\s*$",
    re.MULTILINE,
)


# DI-relevant identifiers — expand as new patterns emerge.
# (Identifiers used in decorators that need runtime references.)
_DI_DECORATOR_RE = re.compile(
    r"@(Body|Query|Param|CurrentUser|Inject|Req|Res|Next|Headers|Ip|UploadedFile|UploadedFiles)\s*\("
)


def _collect_di_identifiers(text: str) -> set[str]:
    """Return identifiers that appear in DI positions (constructors or DI decorators)."""
    out: set[str] = set()

    # 1. Constructor params: `constructor(private foo: FooService, ...)` etc.
    #    We rely on the standard convention: visibility-modifier + colon + name.
    ctor_re = re.compile(
        r"constructor\s*\(([^)]*)\)",
        re.DOTALL,
    )
    for m in ctor_re.finditer(text):
        for param in m.group(1).split(","):
            # `private foo: FooService` → FooService
            tm = re.search(r":\s*([A-Za-z_][A-Za-z0-9_]*)\s*[=,)]?", param)
            if tm:
                out.add(tm.group(1))
            # `private foo: FooService | OtherType` → both
            for tm2 in re.finditer(r"([A-Za-z_][A-Za-z0-9_]*)", param.split(":", 1)[-1]):
                # Filter out JS keywords / number literals
                name = tm2.group(1)
                if name and name[0].isupper():
                    out.add(name)

    # 2. Decorator params: `@Body() user: CreateUserDto` etc.
    #    The type annotation immediately after the decorator param list ends is
    #    what Nest reads at runtime.
    for m in _DI_DECORATOR_RE.finditer(text):
        # Find the next identifier after the closing paren of the decorator
        tail = text[m.end():m.end() + 200]
        tm = re.search(r":\s*([A-Za-z_][A-Za-z0-9_]*)", tail)
        if tm:
            out.add(tm.group(1))

    return out


def _split_imported_names(spec: str) -> tuple[list[str], list[str]]:
    """Split a comma-separated import spec into (original, renamed) entries."""
    entries: list[str] = []
    for raw in spec.split(","):
        clean = raw.strip()
        if not clean:
            continue
        entries.append(clean)
    return entries, []


def _rewrite(text: str) -> tuple[str, list[str]]:
    descriptions: list[str] = []
    di_ids = _collect_di_identifiers(text)
    if not di_ids:
        return text, descriptions

    out_lines: list[str] = []
    last_end = 0
    for m in _IMPORT_TYPE_RE.finditer(text):
        # Emit everything up to this match unchanged.
        out_lines.append(text[last_end:m.start()])

        spec, _ = _split_imported_names(m.group(1))
        live = [name for name in spec if _root_name(name) in di_ids]
        type_only = [name for name in spec if _root_name(name) not in di_ids]

        if not live:
            out_lines.append(text[m.start():m.end()])
            last_end = m.end()
            continue
        if not type_only:
            # Convert the whole import to a value import.
            names = ", ".join(spec)
            new_line = f"import {{ {names} }} from {m.group(2)!r};"
            out_lines.append(new_line)
            descriptions.append(
                f"converted `import type` → value import for {', '.join(live)}"
            )
        else:
            value_line = (
                f"import {{ {', '.join(live)} }} from {m.group(2)!r};"
            )
            type_line = (
                f"import type {{ {', '.join(type_only)} }} from {m.group(2)!r};"
            )
            out_lines.append(value_line)
            out_lines.append(type_line)
            descriptions.append(
                f"split `import type`: {', '.join(live)} → value, "
                f"{', '.join(type_only)} → type"
            )

        last_end = m.end()

    out_lines.append(text[last_end:])
    return "".join(out_lines), descriptions


def _root_name(spec: str) -> str:
    # `X as Y` → X; `X` → X
    return spec.split(" as ")[0].strip()


def _normalize(path: pathlib.Path) -> str:
    """Best-effort relative path for scope checks (see inc-002 for rationale)."""
    s = str(path).replace("\\", "/")
    try:
        return str(path.relative_to(pathlib.Path.cwd())).replace("\\", "/")
    except ValueError:
        return s


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
        print(f"inc-003: file not found: {args.path}", file=sys.stderr)
        return 1

    s = _normalize(args.path)
    if not args.check and not args.apply:
        print("inc-003: must specify --check or --apply", file=sys.stderr)
        return 1

    if not _SCOPE_RE.search(s) or _SKIP_RE.search(s):
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
            f"inc-003: {args.path} needs changes. Re-run with --apply.",
            file=sys.stderr,
        )
        return 2

    args.path.write_text(rewritten)
    for d in descriptions:
        print(f"  applied: {d}", file=sys.stderr)
    print(f"inc-003: applied {args.path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
