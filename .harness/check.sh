#!/usr/bin/env bash
# .harness/check.sh — Auto-check runner for the ai-padrao harness.
#
# Reads .harness/learnings.json and executes every entry that has an
# `auto_check` block. Exits non-zero on the first failure so it can be
# wired into pnpm prebuild / pretest / CI.
#
# Usage:  pnpm harness:check   (from any package or root)

set -euo pipefail

# Resolve repo root regardless of where this is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LEARNINGS="$ROOT/.harness/learnings.json"

if [[ ! -f "$LEARNINGS" ]]; then
  echo "❌ $LEARNINGS not found"
  exit 1
fi

# Pretty output helpers.
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BLUE='\033[0;34m'; NC='\033[0m'
PASS_COUNT=0; FAIL_COUNT=0; SKIP_COUNT=0
declare -a FAILED_CHECKS=()

check() {
  local label="$1"; shift
  printf "${BLUE}[harness]${NC} %-50s " "$label"
  if output="$("$@" 2>&1)"; then
    echo -e "${GREEN}PASS${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "${RED}FAIL${NC}"
    echo "$output" | sed 's/^/        /'
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_CHECKS+=("$label")
  fi
}

note() {
  local label="$1"
  printf "${BLUE}[harness]${NC} %-50s ${YELLOW}SKIP${NC} (manual)\n" "$label"
  SKIP_COUNT=$((SKIP_COUNT + 1))
}

cd "$ROOT"

echo "========================================"
echo "  ai-padrao harness auto-checks"
echo "  Source: .harness/learnings.json"
echo "========================================"
echo

# ---------------------------------------------------------------
# INC-001 — @fastify/static must be a dep of apps/api (with version check)
# ---------------------------------------------------------------
check "INC-001: @fastify/static in apps/api" \
  bash -c '
    cd apps/api
    node -e "
      const p = require(\"./package.json\");
      if (!p.dependencies || !p.dependencies[\"@fastify/static\"]) {
        console.error(\"@fastify/static missing from dependencies\");
        process.exit(1);
      }
      try {
        const fsVersion = require(\"@fastify/static/package.json\").version;
        const fsMajor = parseInt(fsVersion.split(\".\")[0]);
        const fastifyPkg = require(\"fastify/package.json\").version;
        const fastifyMajor = parseInt(fastifyPkg.split(\".\")[0]);
        if (fastifyMajor >= 5 && fsMajor < 8) {
          console.error(\"@fastify/static@\" + fsVersion + \" is too old for fastify@\" + fastifyPkg + \" (need major >= 8)\");
          process.exit(2);
        }
      } catch (e) {
        // package not yet installed locally — skip version check, dep declared is enough
      }
    "
  '

# ---------------------------------------------------------------
# INC-002 — No Express-only response API in apps/api/src
# ---------------------------------------------------------------
check "INC-002: no res.setHeader/res.cookie in apps/api" \
  bash -c '! grep -rnE "res\.(setHeader|cookie)\b" apps/api/src --include="*.ts" 2>/dev/null | grep -v "\.spec\.ts"'

# ---------------------------------------------------------------
# INC-004 — prisma.seed registered in apps/api/package.json
# ---------------------------------------------------------------
check "INC-004: prisma.seed configured" \
  bash -c 'node -e "const p=require(\"./apps/api/package.json\"); if(!p.prisma||!p.prisma.seed) process.exit(1);"'

# ---------------------------------------------------------------
# INC-005 — Health controller has @Public()
# ---------------------------------------------------------------
check "INC-005: health controller @Public()" \
  bash -c 'grep -q "@Public" apps/api/src/contexts/health/infrastructure/http/health-http.controller.ts'

# ---------------------------------------------------------------
# INC-006 — Dockerfile ordering: schema COPY before generate
# Strip comment lines first, then compare actual COPY vs RUN positions.
# ---------------------------------------------------------------
check "INC-006: dockerfile schema-before-generate" \
  bash -c '
    for f in apps/api/Dockerfile.dev apps/api/Dockerfile.prod; do
      [ -f "$f" ] || continue
      # Strip comments and blank lines, then find positions of:
      #   - the first COPY that brings apps/api (or apps/api/prisma)
      #   - the first RUN that contains "prisma generate"
      schema_line=$(grep -nE "^[[:space:]]*COPY" "$f" | grep -E "apps/api(/prisma)?(\s|$)" | head -1 | cut -d: -f1)
      gen_line=$(grep -nE "^[[:space:]]*RUN" "$f" | grep "prisma generate" | head -1 | cut -d: -f1)
      if [ -n "$gen_line" ] && [ -n "$schema_line" ] && [ "$gen_line" -lt "$schema_line" ]; then
        echo "  $f: prisma generate at line $gen_line is BEFORE schema COPY at line $schema_line"
        exit 1
      fi
    done
  '

# ---------------------------------------------------------------
# INC-007 — ESLint --config uses node -p require.resolve
# ---------------------------------------------------------------
check "INC-007: eslint configs use node -p require.resolve" \
  bash -c '
    # Allow only if the --config arg is wrapped in $(node -p ...)
    bad=$(grep -rE "eslint.*--config @[a-z0-9-]+/" --include=package.json . 2>/dev/null | grep -v "node -p" | grep -v "node_modules" || true)
    if [ -n "$bad" ]; then
      echo "$bad"
      exit 1
    fi
  '

# ---------------------------------------------------------------
# INC-008 — docker-compose host ports are non-default
# ---------------------------------------------------------------
check "INC-008: no default port 1025/8025 in compose" \
  bash -c '
    bad=$(grep -E "^\s+-\s+\"(1025|8025):" docker-compose.yml 2>/dev/null || true)
    if [ -n "$bad" ]; then echo "$bad"; exit 1; fi
  '

# ---------------------------------------------------------------
# INC-009 — No console.* in apps/api/src/main.ts
# ---------------------------------------------------------------
check "INC-009: no console.* in main.ts" \
  bash -c '! grep -nE "console\.(log|warn|error|info|debug)" apps/api/src/main.ts'

# ---------------------------------------------------------------
# INC-011 — apps/web test script silences Vite CJS warning
# ---------------------------------------------------------------
check "INC-011: VITE_CJS_IGNORE_WARNING in web test" \
  bash -c 'grep -q "VITE_CJS_IGNORE_WARNING" apps/web/package.json'

# ---------------------------------------------------------------
# INC-012 — Zero skipped tests (no .skip / xit / xdescribe / .todo / --passWithNoTests)
# Scans every tracked source file for forbidden patterns.
# Excludes: node_modules, .next, dist, .turbo, coverage, .standalone.
# Only first-party source under apps/ and packages/ is checked.
# Uses find + grep with explicit prune so deeply-nested build dirs are skipped.
# ---------------------------------------------------------------
check "INC-012: no skipped tests" \
  bash -c '
    set +e
    # Build a list of candidate files, skipping build/cache directories.
    files=$(find apps packages \
      \( -name node_modules -o -name ".next" -o -name dist -o -name ".turbo" -o -name coverage -o -name standalone \) -prune -o \
      -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \) -print 2>/dev/null)
    src_pattern=$(printf "%s\n" "$files" | grep -E "\.(ts|tsx|js|jsx)$" | xargs grep -nE "\b(it|test|describe|context)\.skip\(|\b(xit|xdescribe|xtest)\b|\b(it|test)\.todo\(" 2>/dev/null || true)
    pkg_pattern=$(printf "%s\n" "$files" | grep -E "/package\.json$" | xargs grep -nE -- "--passWithNoTests" 2>/dev/null || true)
    cfg_pattern=$(printf "%s\n" "$files" | grep -E "vitest\.config\.|jest\.config\." | xargs grep -nE "(passWithNoTests|skip[[:space:]]*:)" 2>/dev/null || true)
    if [ -n "$src_pattern$pkg_pattern$cfg_pattern" ]; then
      [ -n "$src_pattern" ] && { echo "  SOURCE code skip patterns:"; echo "$src_pattern" | sed "s/^/    /"; }
      [ -n "$pkg_pattern" ] && { echo "  package.json runner flags:"; echo "$pkg_pattern" | sed "s/^/    /"; }
      [ -n "$cfg_pattern" ] && { echo "  vitest/jest config skip:"; echo "$cfg_pattern" | sed "s/^/    /"; }
      exit 1
    fi
  '

# ---------------------------------------------------------------
# Manual checks (no auto-run — require human judgment)
# ---------------------------------------------------------------
note "INC-003: NestJS DI files don't use import type (requires per-file analysis)"
note "INC-005: e2e test for /api/health without token (requires jest run)"
note "INC-010: NestJS 11 + Swagger 8 peer warning (acceptable upstream)"

# ---------------------------------------------------------------
# INC-013 — Capture tool dependencies: python3 required, jq forbidden in capture paths
# (Hard lesson: the existing prettier PostToolUse hook depends on jq and
# has been silently a no-op. Capture paths MUST be bash + python3 only.)
# ---------------------------------------------------------------
check "INC-013: capture deps (python3 required, jq forbidden)" \
  bash -c '
    if ! command -v python3 >/dev/null 2>&1; then
      echo "  python3 missing — capture.sh and detect.sh will silently no-op."
      exit 1
    fi
    bad=$(grep -nE "\bjq\b" .harness/capture.sh .harness/detect.sh .harness/digest.sh .harness/pattern_match.py 2>/dev/null | grep -vE "^[^:]+:[0-9]+:#" || true)
    if [ -n "$bad" ]; then
      echo "  capture scripts must not depend on jq (silent no-op risk):"
      echo "$bad" | sed "s/^/    /"
      exit 1
    fi
  '

# ---------------------------------------------------------------
# INC-014 — events/ directory is git-ignored (per-session state, not source of truth)
# ---------------------------------------------------------------
check "INC-014: events/ is gitignored" \
  bash -c '
    # Find the .gitignore that covers the harness dir.
    gi=$(grep -E "^\.harness/events" .gitignore 2>/dev/null || true)
    if [ -z "$gi" ]; then
      echo "  .gitignore does not contain an entry for .harness/events/"
      echo "  Add a line like: .harness/events/"
      exit 1
    fi
  '

# ---------------------------------------------------------------
# INC-015 — digest freshness: at least one digest/ entry mtime < 25h
# (The daily agent must be running. If no digest was written in the
# last 25h, the harness has stopped learning.)
# ---------------------------------------------------------------
check "INC-015: digest freshness" \
  bash -c '
    if [ ! -d .harness/digest ]; then
      echo "  .harness/digest/ does not exist — daily agent never ran."
      echo "  Run: pnpm harness:digest"
      exit 1
    fi
    latest=$(find .harness/digest -maxdepth 1 -type f -name "*.md" -printf "%T@\n" 2>/dev/null | sort -n | tail -1)
    if [ -z "$latest" ]; then
      echo "  no digest files found in .harness/digest/"
      echo "  Run: pnpm harness:digest"
      exit 1
    fi
    now=$(date +%s)
    age=$(( now - ${latest%.*} ))
    if [ "$age" -gt 90000 ]; then
      echo "  newest digest is ${age}s old (>25h). Daily agent not running."
      echo "  Run: pnpm harness:digest"
      exit 1
    fi
  '

# ---------------------------------------------------------------
# INC-016 — No hardcoded secrets in any tracked source file
# (Heuristic: grep for Anthropic/GitHub/OpenAI/AWS token shapes in the
# first-party source. .env, .env.example, and node_modules are excluded.)
# ---------------------------------------------------------------
check "INC-016: no hardcoded secrets in tracked source" \
  bash -c '
    set +e
    hits=$(
      grep -rnE "sk-ant-[A-Za-z0-9_-]{8,}|sk-cp-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,}|sk-[A-Za-z0-9]{32,}|AKIA[0-9A-Z]{16}" \
        apps packages \
        --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
        --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=.turbo --exclude-dir=coverage --exclude-dir=standalone \
        --exclude="*.spec.ts" --exclude="*.spec.tsx" --exclude="*.spec.js" --exclude="*.spec.jsx" \
        --exclude="*.test.ts" --exclude="*.test.tsx" --exclude="*.test.js" --exclude="*.test.jsx" \
        --exclude="*.mock.ts" --exclude="*.fixture.ts" \
        2>/dev/null \
        || true
    )
    if [ -n "$hits" ]; then
      echo "  Hardcoded token-shaped strings detected in source:"
      echo "$hits" | sed "s/^/    /"
      echo "  Move to .env (which is gitignored) or a secret store."
      exit 1
    fi
  '

# ---------------------------------------------------------------
# INC-017 — L2 detector excludes documentation paths from file-axis
# (a) The SOURCE_PATH_PATTERNS constant must still exist in pattern_match.py
#     so the docs-path filter is wired up. (b) The regression tests in
# .harness/test_pattern_match.py must pass.
# ---------------------------------------------------------------
check "INC-017: detector excludes docs from file-axis" \
  bash -c '
    if ! grep -q "SOURCE_PATH_PATTERNS" .harness/pattern_match.py; then
      echo "  .harness/pattern_match.py does not declare SOURCE_PATH_PATTERNS"
      echo "  Without it, INC-002/INC-003 will false-positive on doc writes."
      exit 1
    fi
    if ! cd .harness && python3 -m unittest test_pattern_match >/dev/null 2>&1; then
      echo "  .harness/test_pattern_match.py failed."
      echo "  Run: cd .harness && python3 -m unittest test_pattern_match -v"
      exit 1
    fi
  '

# ---------------------------------------------------------------
# INC-027 — Cyclomatic complexity ≤ 10 enforced across apps/* and packages/*
# Runs ESLint with the repo's shared base config so the same rule that's
# enforced per-workspace by `pnpm lint` is also enforced at the harness
# layer. Functions over the threshold (10) fail the build. Test files
# are intentionally in scope; legitimate hotspots use
# `// eslint-disable-next-line complexity -- <reason>` (see design.md in
# .openspec/changes/complexity-gate/).
# ---------------------------------------------------------------
check "INC-027: cyclomatic complexity ≤ 10 in apps/ and packages/" \
  bash -c '
    set +e
    out=$(pnpm exec eslint --no-warn-ignored \
      --no-config-lookup \
      --config packages/config-eslint/base.js \
      apps packages \
      --ext .ts,.tsx 2>&1)
    rc=$?
    complexity_errors=$(printf "%s\n" "$out" | grep -E "complexity" || true)
    if [ -n "$complexity_errors" ]; then
      echo "$complexity_errors" | sed "s/^/  /"
      echo "  One or more functions in apps/ or packages/ exceed cyclomatic complexity 10."
      echo "  Split into helpers, or annotate with \`// eslint-disable-next-line complexity\`"
      echo "  and a justification comment."
      exit 1
    fi
    if [ "$rc" -ne 0 ] && [ "$rc" -ne 1 ]; then
      echo "  ESLint failed to run for an unrelated reason (exit $rc):"
      echo "$out" | sed "s/^/    /" | tail -20
      exit 1
    fi
  '

# ---------------------------------------------------------------
# INC-018 — L2 detector excludes Read/TodoWrite/worktree/heredoc/tool_input
# Ten required features must be present in pattern_match.py (covers
# INC-017, INC-018, INC-019, INC-020, INC-021, INC-022). Without all ten,
# the detector false-positives on every session action.
#   1. INC-018 Read-skip
#   2. INC-018 TodoWrite-skip
#   3. INC-018 worktree-regex
#   4. INC-018 heredoc-regex (python3 << support)
#   5. INC-018 tool_input-command lookup
#   6. INC-018 absolute-path-regex tolerates leading slash
#   7. INC-018 tmp-path-regex
#   8. INC-019 diagnostic-bash regex accepts commands after shell separators
#   9. INC-020 alphabetic symbol-axis uses word boundaries
#  10. INC-021+022 shapes + required_features recognized in trigger_pattern
# ---------------------------------------------------------------
check "INC-018: detector excludes Read/TodoWrite/worktree/heredoc" \
  bash -c '
    pm=.harness/pattern_match.py
    missing=""
    if ! grep -qE "ev\.get\(\"tool_name\"\)\s*==\s*\"Read\"" "$pm"; then
      missing="$missing Read-skip"
    fi
    if ! grep -qE "_TODO_TOOL_NAME" "$pm"; then
      missing="$missing TodoWrite-skip"
    fi
    if ! grep -qE "claude/worktrees" "$pm"; then
      missing="$missing worktree-regex"
    fi
    if ! grep -qE "python3\\\\s\\+\\(\\?:\\-c\\\\b\\|<<\\)" "$pm"; then
      missing="$missing heredoc-regex"
    fi
    if ! grep -qE "tool_input[^]]*command" "$pm"; then
      missing="$missing tool_input-command"
    fi
    if ! grep -qE "\(\?:\^|/\)" "$pm"; then
      missing="$missing absolute-path-regex"
    fi
    if ! grep -qE "/tmp/" "$pm"; then
      missing="$missing tmp-path-regex"
    fi
    # INC-019: diagnostic-bash regex must allow diagnostic commands to appear
    # after whitespace or shell separators, not only at position 0.
    if ! grep -qF "(?:^|[" "$pm"; then
      missing="$missing shell-separator-bash-regex (INC-019)"
    fi
    # INC-020: alphabetic symbols use word-boundary regex (\b...\b).
    if ! grep -qF "_symbol_matches" "$pm"; then
      missing="$missing word-boundary-symbol-matcher (INC-020)"
    fi
    # INC-021: shapes field is read alongside symbols.
    if ! grep -qF "shapes" "$pm"; then
      missing="$missing shapes-axis (INC-021)"
    fi
    # INC-022: required_features anti-pattern gate is implemented.
    if ! grep -qF "required_features" "$pm"; then
      missing="$missing required_features-axis (INC-022)"
    fi
    if [ -n "$missing" ]; then
      echo "  .harness/pattern_match.py is missing INC-018..INC-022 features:$missing"
      echo "  Without them, the L2 detector false-positives on multi-line"
      echo "  bash scripts, alphabetic symbol substrings, INC-016 file-axis,"
      echo "  and INC-018 edits to pattern_match.py itself."
      exit 1
    fi
  '

# ---------------------------------------------------------------
# INC-028 — Documentation coverage (Diátaxis-classified, see ADR-018)
# Three sub-checks: BC README presence, JSDoc coverage on staged
# files, ADR cross-ref integrity.
# Skill: ~/.claude/skills/documentation/
# ---------------------------------------------------------------
DOC_SKILL="$HOME/.claude/skills/documentation/bin"
if [ ! -x "$DOC_SKILL/audit-report.py" ]; then
  note "INC-028: documentation skill not installed (~/.claude/skills/documentation/bin/audit-report.py missing)"
else
  check "INC-028a: every bounded context has README.md" \
    bash -c "
      for d in apps/api/src/contexts/*/ apps/web/src/features/*/; do
        [ -d \"\$d\" ] || continue
        d_clean=\"\${d%/}\"
        [ -f \"\$d_clean/README.md\" ] || { echo \"missing: \$d_clean/README.md\"; exit 1; }
      done
    "

  check "INC-028b: ADR cross-references resolve" \
    bash -c "python3 \"$DOC_SKILL/adr_ref_check.py\" \"$ROOT\" >/dev/null"

  # JSDoc coverage is only meaningful on staged files.
  # `tr '\n' ' '` flattens the newline-separated list into space-separated
  # args — otherwise `bash -c "python3 ... $STAGED_TS"` interprets each
  # path as a separate command line (INC-028c fails with "Permission denied").
  # `|| true` neutralises bash 5.2's set -e + pipefail abort: when the staged
  # list is empty, `grep -vE` returns 1, pipefail makes the pipeline fail,
  # and the substitution's exit code becomes the assignment's exit code.
  # Without `|| true`, `set -e` would abort the script before reaching the
  # `if [ -z "$STAGED_TS" ]` early-return below. Confirmed empirically on
  # bash 5.2.21; the assignment-level abort only triggers when the leftmost
  # command in the substitution is an external binary (git), not a builtin.
  STAGED_TS=$(git diff --name-only --cached --diff-filter=AM -- 'apps/**/*.ts' 'apps/**/*.tsx' 'packages/*/src/**/*.ts' 'packages/*/src/**/*.tsx' 2>/dev/null | grep -vE '\.spec\.ts$|\.test\.tsx?$|index\.ts$' | head -50 | tr '\n' ' ' | sed 's/ $//' || true)
  if [ -z "$STAGED_TS" ]; then
    note "INC-028c: JSDoc coverage on staged files (no staged .ts/.tsx outside specs)"
  else
    check "INC-028c: JSDoc coverage ≥ 80% on staged .ts/.tsx files" \
      bash -c "python3 \"$DOC_SKILL/jsdoc_coverage.py\" --threshold 80 $STAGED_TS >/dev/null"
  fi
fi

echo
echo "========================================"
echo -e "  ${GREEN}PASS${NC}: $PASS_COUNT  ${RED}FAIL${NC}: $FAIL_COUNT  ${YELLOW}SKIP${NC}: $SKIP_COUNT"
echo "========================================"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo
  echo -e "${RED}FAILED:${NC}"
  for c in "${FAILED_CHECKS[@]}"; do
    echo "  - $c"
  done
  echo
  echo "Each failure corresponds to a real incident in .harness/INCIDENTS.md."
  echo "Fix the underlying issue, not the check."
  exit 1
fi

echo
echo -e "${GREEN}All auto-checks pass.${NC}"
echo "Harness converged (for now). New incidents → .harness/INCIDENTS.md"
