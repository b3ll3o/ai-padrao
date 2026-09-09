#!/usr/bin/env bash
# Restore a Postgres backup produced by backup-postgres.sh.
# Usage: restore-postgres.sh <path-to-sql.gz>
# Requires a second confirmation before writing to the live database.

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/ai-padrao/infra/.env.production}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/ai-padrao/repo}"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <path-to-sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL: env file not found at $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "FAIL: backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${POSTGRES_USER:?POSTGRES_USER must be set}"
: "${POSTGRES_DB:?POSTGRES_DB must be set}"

echo "About to restore '$BACKUP_FILE' into database '$POSTGRES_DB'."
echo "This will REPLACE all data in the live database."
read -r -p "Type 'yes' to continue: " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Aborted."
  exit 1
fi

gunzip -c "$BACKUP_FILE" | ( cd "$COMPOSE_DIR" && \
  docker compose \
    -f docker-compose.yml \
    -f infra/compose/docker-compose.vps.yml \
    --profile dev-tools \
    exec -T postgres \
      psql -U "$POSTGRES_USER" "$POSTGRES_DB" \
  )

echo "OK: restore complete"
