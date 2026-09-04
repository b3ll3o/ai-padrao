#!/usr/bin/env bash
# .harness/detect.sh — L2 inline pattern detector.
#
# Reads the last 20 lines of .harness/events/<today>.jsonl into the
# pattern matcher and exits non-zero if any entry in learnings.json
# has been re-observed. The PostToolUse hook contract treats non-zero
# exit as a "soft" warning that Claude surfaces to the user, who can
# then confirm or override.
#
# INC-029 — operator opt-out: setting `HARNESS_L2_ENABLED=0` (or any
# falsy value: `false`, `no`, `off`, empty) disables L2 detection for
# this hook invocation without modifying `~/.claude/settings.json`. This
# is the recommended escape hatch when the detector fires on legitimate
# read-only operations (lint, typecheck, test-listing). The harness still
# captures every event via `capture.sh` so disabling L2 only silences the
# confirmation prompts — it does NOT stop the sensor from learning.
#
# Exit codes:
#   0 = no match (normal flow)
#   2 = match found, INC id printed to stderr
#   1 = internal error (treated as "no match" by the hook)

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TODAY="$(date -u +%F)"
EVENTS="$ROOT/events/$TODAY.jsonl"

# INC-029 — escape hatch. Default is ON (`1`); explicit `0`, `false`,
# `no`, `off`, or empty value turns it off. Any other value (including
# unset) preserves the original behaviour.
L2_FLAG="${HARNESS_L2_ENABLED:-1}"
case "${L2_FLAG,,}" in
  0|false|no|off|"")
    exit 0
    ;;
esac

if [[ ! -f "$EVENTS" ]]; then
  exit 0
fi

PY="$(command -v python3 2>/dev/null || true)"
if [[ -z "$PY" ]]; then
  exit 0
fi

# Tail the last WINDOW_SIZE lines (20) into the matcher.
WINDOW=20
WINDOW_TEXT="$(tail -n "$WINDOW" "$EVENTS" 2>/dev/null || true)"

if [[ -z "$WINDOW_TEXT" ]]; then
  exit 0
fi

MATCH_ID="$(printf '%s\n' "$WINDOW_TEXT" | "$PY" "$ROOT/pattern_match.py" 2>/dev/null || true)"

if [[ -n "$MATCH_ID" ]]; then
  # Non-zero + write to stderr so the hook surfaces it as a soft warning.
  printf 'harness-detect: matched %s in recent events — confirm with user before proceeding\n' "$MATCH_ID" >&2
  exit 2
fi

exit 0