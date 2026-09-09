#!/usr/bin/env bash
# Smoke test: validates the deployed stack responds correctly.
# Reads DOMAIN, MAILHOG_SUBDOMAIN from the env file.
# Exit 0 on success, non-zero on any failure.

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/ai-padrao/infra/.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL: env file not found at $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${DOMAIN:?DOMAIN must be set in $ENV_FILE}"

echo "==> Smoke test against https://${DOMAIN}"

fail() { echo "FAIL: $1" >&2; exit 1; }

wait_for_https() {
  local url="$1" tries=30
  for ((i = 1; i <= tries; i++)); do
    if curl -fsSI -m 5 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  fail "https endpoint not reachable: $url"
}

# 1. TLS handshake on web root
echo "1/5 TLS handshake (https://${DOMAIN}/)"
wait_for_https "https://${DOMAIN}/"

# 2. Web root renders HTML
echo "2/5 Web root HTML"
body=$(curl -fsSL -m 30 "https://${DOMAIN}/")
echo "$body" | grep -qi '<title' || fail "web root missing <title> tag"

# 3. API health endpoint
echo "3/5 API health (https://${DOMAIN}/api/v1/health)"
curl -fsS -m 10 "https://${DOMAIN}/api/v1/health" >/dev/null \
  || fail "api /health did not return 2xx"

# 4. MailHog UI (conditional)
if [[ "${MAILHOG_SUBDOMAIN:-false}" == "true" ]]; then
  echo "4/5 MailHog UI (https://mail.${DOMAIN}/)"
  wait_for_https "https://mail.${DOMAIN}/"
else
  echo "4/5 MailHog UI (skipped: MAILHOG_SUBDOMAIN != true)"
fi

# 5. Postgres reachable from the host compose network
echo "5/5 Postgres health"
COMPOSE_DIR="$(cd "$(dirname "$ENV_FILE")/../repo" && pwd)"
( cd "$COMPOSE_DIR" && \
  docker compose \
    -f docker-compose.yml \
    -f infra/compose/docker-compose.vps.yml \
    --profile dev-tools \
    exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
) >/dev/null \
  || fail "postgres pg_isready failed"

echo "OK: all smoke checks passed"