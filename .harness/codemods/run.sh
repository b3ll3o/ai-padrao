#!/usr/bin/env bash
# .harness/codemods/run.sh — thin wrapper for any codemod in this directory.
#
# Usage:
#   run.sh <codemod-name> --check <file> [<file> ...]
#   run.sh <codemod-name> --apply <file> [<file> ...]
#
# The wrapper does three things:
#   1. Resolves the codemod script (default extension: .py).
#   2. Appends a small invocation event to .harness/events/$(date -u +%F).jsonl
#      so the inline detector (L2) can correlate codemod use with INC patterns.
#   3. Forwards --check / --apply <files> to the script.
#
# Exit codes match the codemod's own contract:
#   0 = no changes needed (or already applied)
#   1 = usage / error
#   2 = --check found changes needed (and they were not applied)

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_ROOT="$(cd "$ROOT/.." && pwd)"

if [[ $# -lt 3 ]]; then
  echo "usage: run.sh <codemod-name> --check|--apply <file> [<file> ...]" >&2
  exit 1
fi

CODEMOD="$1"
MODE="$2"
shift 2

case "$MODE" in
  --check|--apply) ;;
  *)
    echo "run.sh: mode must be --check or --apply (got: $MODE)" >&2
    exit 1
    ;;
esac

# Resolve the codemod script. Tolerate either .py or no extension.
if [[ -f "$ROOT/${CODEMOD}.py" ]]; then
  SCRIPT="$ROOT/${CODEMOD}.py"
elif [[ -f "$ROOT/${CODEMOD}" ]]; then
  SCRIPT="$ROOT/${CODEMOD}"
else
  echo "run.sh: codemod not found: $CODEMOD (.py tried)" >&2
  exit 1
fi

PY="$(command -v python3 2>/dev/null || true)"
if [[ -z "$PY" ]]; then
  echo "run.sh: python3 required (INC-013)" >&2
  exit 1
fi

# Trace this invocation into the events stream (best-effort, no-op on failure).
TRACE_PAYLOAD=$(printf '{"ts":"%s","tool_name":"Bash","command":"codemod %s %s","description":"Codemod invocation","filePath":""}\n' \
  "$(date -u +%FT%TZ)" "$CODEMOD" "$MODE")
TRACE_DIR="$HARNESS_ROOT/events"
TARGET="$TRACE_DIR/$(date -u +%F).jsonl"
if mkdir -p "$TRACE_DIR" 2>/dev/null; then
  printf '%s' "$TRACE_PAYLOAD" | "$PY" "$HARNESS_ROOT/redact.py" 2>/dev/null >> "$TARGET" || true
fi

# Invoke the codemod. The codemod scripts use argparse with a positional
# `path` argument and `--check` / `--apply` flags. The wrapper receives
# `--check <file> ...` and forwards `<file> ... --check` (or `--apply`).
"$PY" "$SCRIPT" "$@" "$MODE"