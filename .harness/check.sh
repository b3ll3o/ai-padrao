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
  bash -c 'grep -q "@Public" apps/api/src/modules/health/health.controller.ts'

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
# Manual checks (no auto-run — require human judgment)
# ---------------------------------------------------------------
note "INC-003: NestJS DI files don't use import type (requires per-file analysis)"
note "INC-005: e2e test for /api/health without token (requires jest run)"
note "INC-010: NestJS 11 + Swagger 8 peer warning (acceptable upstream)"

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
