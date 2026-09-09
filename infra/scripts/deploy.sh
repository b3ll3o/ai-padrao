#!/usr/bin/env bash
# Deploy the ai-padrao stack from the current git HEAD.
# Designed to be invoked by GitHub Actions over SSH, or manually:
#   ssh deploy@host 'bash /opt/ai-padrao/repo/infra/scripts/deploy.sh'

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/ai-padrao/repo}"
COMPOSE_BASE="${COMPOSE_BASE:-docker-compose.yml}"
COMPOSE_OVERRIDE="${COMPOSE_OVERRIDE:-infra/compose/docker-compose.vps.yml}"

cd "$REPO_DIR"

echo "==> Fetching latest from origin"
git fetch --prune
git reset --hard "origin/${GIT_BRANCH:-main}"
git clean -fdx -e infra/.env.production -e infra/data/

echo "==> Building images"
docker compose \
  -f "$COMPOSE_BASE" \
  -f "$COMPOSE_OVERRIDE" \
  --profile dev-tools \
  build --pull

echo "==> Starting stack"
docker compose \
  -f "$COMPOSE_BASE" \
  -f "$COMPOSE_OVERRIDE" \
  --profile dev-tools \
  up -d

echo "==> Waiting for postgres health"
for i in {1..30}; do
  if docker compose \
    -f "$COMPOSE_BASE" \
    -f "$COMPOSE_OVERRIDE" \
    --profile dev-tools \
    exec -T postgres pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Applying Prisma migrations"
docker compose \
  -f "$COMPOSE_BASE" \
  -f "$COMPOSE_OVERRIDE" \
  --profile dev-tools \
  exec -T api pnpm prisma migrate deploy

echo "==> Smoke test"
ENV_FILE="${ENV_FILE:-/opt/ai-padrao/infra/.env.production}" \
  infra/scripts/smoke-test.sh

echo "OK: deploy complete"