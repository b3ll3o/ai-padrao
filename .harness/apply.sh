#!/usr/bin/env bash
# .harness/apply.sh — Apply a safe proposed patch under .harness/proposed/.
#
# Refuses to apply any patch that:
#   - touches a file outside .harness/
#   - modifies an existing entry in .harness/learnings.json (only appends allowed)
#   - deletes content (any '-' line other than the diff header)
#   - modifies .harness/check.sh (these are reviewed by hand)
#
# Patches are *.patch (unified diff) and are checked before `git apply`.
#
# Usage:
#   pnpm harness:apply                  # apply today's patch
#   pnpm harness:apply --date YYYY-MM-DD # apply a specific date
#   pnpm harness:apply --dry-run        # show what would be applied

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROPOSED_DIR="$ROOT/proposed"
DATE="${APPLY_DATE:-$(date -u +%F)}"
DRY_RUN="false"

for arg in "$@"; do
  case "$arg" in
    --date=*) DATE="${arg#--date=}" ;;
    --date) shift; DATE="${1:-}" ;;
    --dry-run) DRY_RUN="true" ;;
  esac
done

PATCH="$PROPOSED_DIR/$DATE.patch"
if [[ ! -f "$PATCH" ]]; then
  printf 'No patch found at %s\n' "$PATCH" >&2
  exit 1
fi

# Risk guard: refuse if patch tries to modify a forbidden path.
# Diff headers look like "+++ b/apps/api/foo.ts" or "--- a/apps/api/foo.ts",
# so the regexes must match the path portion, not the whole line. The
# leading "+++ b/" or "--- a/" prefix is stripped before matching.
_FORBIDDEN_PATH_RE='((apps|packages)/|docker-compose\.yml|Dockerfile\.(dev|prod)$|\.harness/(check\.sh|learnings\.json)$)'

# Look at the file paths declared in the diff (lines like "+++ b/path" or "--- a/path").
HIT=""
while IFS= read -r line; do
  # Strip the "+++ b/" or "--- a/" prefix.
  path="${line#+++ b/}"
  path="${path#--- a/}"
  case "$path" in
    ''|'/dev/null') continue ;;
  esac
  if [[ "$path" =~ $_FORBIDDEN_PATH_RE ]]; then
    HIT+="$line (matches forbidden path: $path)\n"
    break
  fi
done < <(grep -E '^(---|\+\+\+) ' "$PATCH" 2>/dev/null || true)

if [[ -n "$HIT" ]]; then
  printf 'Refusing to apply: patch touches forbidden paths:\n%s' "$HIT" >&2
  exit 2
fi

# Risk guard: refuse if patch has deletion lines (other than diff headers).
if grep -E '^[-+]' "$PATCH" 2>/dev/null | grep -vE '^(\+\+\+|---) ' | grep -qE '^-'; then
  printf 'Refusing to apply: patch contains deletion lines (only appends allowed).\n' >&2
  exit 2
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Would apply: $PATCH"
  echo "---"
  cat "$PATCH"
  exit 0
fi

if git apply --check "$PATCH" 2>/dev/null; then
  git apply "$PATCH"
  printf 'Applied %s\n' "$PATCH"
else
  printf 'Patch does not apply cleanly: %s\n' "$PATCH" >&2
  exit 3
fi