#!/usr/bin/env bash
# .harness/capture.sh — Append one JSONL event to .harness/events/<date>.jsonl
#
# Triggered by Claude Code PostToolUse hook on Bash|Edit|Write|MCP tools.
# Reads the hook payload from stdin (Claude Code passes JSON on stdin),
# pipes it through python3 redact.py, and appends one JSON line to the
# today's NDJSON file under .harness/events/.
#
# ALWAYS exits 0 — capture failures must never block the user. The harness
# learns from everything that happens, but it does not punish the operator
# for transient failures.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVENTS_DIR="$ROOT/events"
TODAY="$(date -u +%F)"
TARGET="$EVENTS_DIR/$TODAY.jsonl"

# Ensure events dir exists. If we can't create it, exit silently.
if ! mkdir -p "$EVENTS_DIR" 2>/dev/null; then
  exit 0
fi

# Resolve python3 (we never depend on `jq` — see INC-013).
PY="$(command -v python3 2>/dev/null || true)"
if [[ -z "$PY" ]]; then
  exit 0
fi

# Pipe stdin through the redactor; if redaction fails for any reason, drop
# the event silently rather than blocking the user.
if ! REDACTED="$("$PY" "$ROOT/redact.py" 2>/dev/null)"; then
  exit 0
fi
if [[ -z "$REDACTED" ]]; then
  exit 0
fi

# Validate the redactor produced JSON. If not, drop.
if ! printf '%s' "$REDACTED" | "$PY" -c 'import json,sys; json.loads(sys.stdin.read())' 2>/dev/null; then
  exit 0
fi

# Append atomically: write to a per-PID temp file, then concatenate.
TMP="$(mktemp "${TARGET}.lock.XXXXXX" 2>/dev/null)" || exit 0
if ! printf '%s\n' "$REDACTED" > "$TMP" 2>/dev/null; then
  rm -f "$TMP" 2>/dev/null || true
  exit 0
fi

# flock-style append via `cat >> target`. Best-effort under contention;
# ordering is preserved per-process but interleaving across processes can
# shuffle lines. That's acceptable for an observation stream.
if command -v flock >/dev/null 2>&1; then
  (
    flock -x 9 || true
    cat "$TMP" >> "$TARGET"
  ) 9>"${TARGET}.flock" 2>/dev/null || cat "$TMP" >> "$TARGET" 2>/dev/null
else
  cat "$TMP" >> "$TARGET" 2>/dev/null
fi
rm -f "$TMP" "${TARGET}.flock" 2>/dev/null || true

exit 0