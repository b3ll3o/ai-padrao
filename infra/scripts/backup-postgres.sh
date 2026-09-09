#!/usr/bin/env bash
# Hourly Postgres backup with rotation.
# Reads PG creds from the env file and writes gzipped SQL dumps to
# infra/data/backups/. Keeps the last BACKUP_KEEP_DAYS days.

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/ai-padrao/infra/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-/opt/ai-padrao/infra/data/backups}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/ai-padrao/repo}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL: env file not found at $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${POSTGRES_USER:?POSTGRES_USER must be set}"
: "${POSTGRES_DB:?POSTGRES_DB must be set}"
: "${BACKUP_KEEP_DAYS:=7}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

stamp="$(date -u +%Y%m%d-%H%M)"
out="$BACKUP_DIR/db-${stamp}.sql.gz"

echo "==> pg_dump -> $out"
( cd "$COMPOSE_DIR" && \
  docker compose \
    -f docker-compose.yml \
    -f infra/compose/docker-compose.vps.yml \
    --profile dev-tools \
    exec -T postgres \
      pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
) | gzip -9 > "$out"

# Rotate: delete files older than BACKUP_KEEP_DAYS days
find "$BACKUP_DIR" -type f -name 'db-*.sql.gz' -mtime "+${BACKUP_KEEP_DAYS}" -delete

echo "OK: backup written and rotated"