# VPS Deploy (Dev Environment) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote `ai-padrao` from local-only (`pnpm up`) to a reproducible dev environment on a fresh Ubuntu VPS, with HTTPS via Caddy + Let's Encrypt, deploys triggered by GitHub Actions on push to `main`, and all configuration committed to the repository.

**Architecture:** Single `docker-compose.yml` (existing at repo root) + an override file at `infra/compose/docker-compose.vps.yml` (Approach A — single source of truth for the service graph). MailHog + OTel collector stay available via `--profile dev-tools`. Caddy terminates TLS with automatic Let's Encrypt HTTP-01 certificates. GitHub Actions runs `lint + typecheck + test:all` on every push, then SSHs into the VPS and runs `infra/scripts/deploy.sh` which does `git pull`, `docker compose build`, `docker compose up -d`, `prisma migrate deploy`, and `smoke-test.sh`. One-time `bootstrap-vps.sh` configures the VPS (user, firewall, Docker, secrets, cron) from scratch.

**Tech Stack:** Docker Compose v2, Caddy 2 (alpine), GitHub Actions, OpenSSH with deploy keys, ufw + fail2ban, Prisma 6, Bash 5.x.

**Spec:** [docs/superpowers/specs/2026-09-09-vps-deploy-design.md](../specs/2026-09-09-vps-deploy-design.md)

---

## File Structure

Files **created** by this plan (all under repo root unless noted):

```
infra/
├── README.md                                    # Tasks 12
├── .env.production.example                      # Task 1
├── compose/
│   └── docker-compose.vps.yml                   # Task 4
├── caddy/
│   ├── Caddyfile                                # Task 3
│   └── Dockerfile                               # Task 3
└── scripts/
    ├── bootstrap-vps.sh                         # Task 9
    ├── deploy.sh                                # Task 8
    ├── smoke-test.sh                            # Task 5
    ├── backup-postgres.sh                       # Task 6
    └── restore-postgres.sh                      # Task 7

.github/workflows/
└── deploy-vps.yml                               # Task 10
```

Files **modified**:

```
docker-compose.yml                               # Task 2 (add profiles)
.gitignore                                       # Task 1 (add prod secrets)
README.md                                        # Task 12 (add "Deploy to VPS" section)
```

**Decomposition rationale:** Each task creates or modifies exactly one logical unit (a file or a tightly-coupled pair like Caddyfile + Dockerfile which always ship together). Tasks that share a file are sequenced; tasks across independent files run in parallel within their phase.

---

## Phases

1. **Foundation** (Tasks 1–2) — repo skeleton + base compose change. Sequential.
2. **Configs** (Tasks 3–4) — Caddy image + compose override. Parallel.
3. **Scripts** (Tasks 5–9) — shell scripts in dependency order.
4. **CI/CD** (Task 10) — GitHub Actions workflow. After scripts so it can reference them.
5. **Docs** (Task 11–12) — `infra/README.md` + root `README.md`. Parallel after CI.
6. **Final validation** (Task 13) — full end-to-end dry-run + smoke checks.

Total: 13 tasks. Tasks 3+4 and 11+12 are intra-phase parallel. All others are sequential.

---

## Task 1: Repo skeleton + .gitignore + .env.production.example

**Files:**
- Create: `infra/.env.production.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create `infra/.env.production.example`**

Exact content:

```dotenv
# --- Required for VPS deploy (production-like dev) ---
# Copy to infra/.env.production on the VPS and fill in real values.
# NEVER commit the populated file.

# --- Domain / TLS ---
DOMAIN=example.com
LETSENCRYPT_EMAIL=ops@example.com

# --- Database ---
POSTGRES_USER=ai_padrao
POSTGRES_PASSWORD=CHANGEME_openssl_rand_base64_48
POSTGRES_DB=ai_padrao
DATABASE_URL=postgresql://ai_padrao:CHANGEME_openssl_rand_base64_48@postgres:5432/ai_padrao?schema=public

# --- API (NestJS) ---
NODE_ENV=production
API_PORT=3001
API_INTERNAL_URL=http://api:3001
JWT_ACCESS_SECRET=CHANGEME_openssl_rand_base64_48
JWT_REFRESH_SECRET=CHANGEME_openssl_rand_base64_48
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CORS_ORIGINS=https://example.com

# --- Web (Next.js) ---
WEB_PORT=3000
NEXT_PUBLIC_API_URL=https://example.com
API_URL=http://api:3001
WEB_ORIGIN=https://example.com

# --- OpenTelemetry ---
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_SERVICE_NAME=ai-padrao

# --- SMTP (MailHog in dev / VPS) ---
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_FROM=no-reply@example.com

# --- Operational ---
RUN_SEED=false
BACKUP_KEEP_DAYS=7
MAILHOG_SUBDOMAIN=true
```

- [ ] **Step 2: Update `.gitignore` to ignore production secrets and infra data**

Append the following block to the existing `.gitignore` (after its last line, preserving a trailing newline):

```
infra/.env.production
infra/data/

# Local SSH keys for testing deploys
*.pem
```

- [ ] **Step 3: Verify changes**

Run from repo root:

```bash
test -f infra/.env.production.example && echo "example OK"
grep -q '^infra/.env.production$' .gitignore && echo "gitignore OK"
```

Expected output: both lines containing `OK`.

- [ ] **Step 4: Commit**

```bash
git add infra/.env.production.example .gitignore
git commit -m "feat(infra): add .env.production.example and ignore prod secrets

Sets up the repo to ship the shape of the production env in version
control while keeping real secrets out. The .env.production file lives
only on the VPS at /opt/ai-padrao/infra/.env.production (chmod 600)."
```

---

## Task 2: Add dev-tools profiles to base docker-compose.yml

**Files:**
- Modify: `docker-compose.yml` (services `mailhog` and `otel-collector`)

- [ ] **Step 1: Add `profiles: ["dev-tools"]` to `mailhog`**

In `docker-compose.yml`, in the `mailhog:` service block, add a `profiles:` key so the service becomes opt-in via `--profile dev-tools`. Insert immediately under `container_name:`:

```yaml
  mailhog:
    image: mailhog/mailhog:v1.0.1
    container_name: ai-padrao-mailhog
    profiles:
      - dev-tools
    ports:
```

- [ ] **Step 2: Add `profiles: ["dev-tools"]` to `otel-collector`**

Same change for `otel-collector:`. Insert immediately under `container_name:`:

```yaml
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.110.0
    container_name: ai-padrao-otel
    profiles:
      - dev-tools
    command: ["--config=/etc/otel/config.yaml"]
```

- [ ] **Step 3: Verify the change does not break local dev**

Local dev (no `--profile`) should still bring up `postgres + api + web` only. The user's intent is that MailHog + OTel stay available locally via `--profile dev-tools`. Run:

```bash
docker compose config --services
```

Expected output (no profile):

```
api
postgres
web
```

Run again with the profile:

```bash
docker compose --profile dev-tools config --services
```

Expected output:

```
api
mailhog
otel-collector
postgres
web
```

If output matches both lists, the profile change is correct.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(root): gate mailhog+otel behind --profile dev-tools

Local dev now defaults to api+postgres+web only. MailHog and the OTel
collector become opt-in via '--profile dev-tools'. The VPS deploy
activates this profile so the dev email and tracing flows remain
available on the VPS too."
```

---

## Task 3: Caddy image (Caddyfile + Dockerfile)

**Files:**
- Create: `infra/caddy/Caddyfile`
- Create: `infra/caddy/Dockerfile`

- [ ] **Step 1: Create `infra/caddy/Caddyfile`**

Exact content:

```caddyfile
{$DOMAIN} {
    encode gzip zstd
    # Block requests for sensitive paths at the proxy layer.
    # Returns 404 instead of leaking that the files exist.
    @blocked path /.env /.git/* /admin/* /.dockerignore /.openspec/* /Dockerfile*
    respond @blocked 404

    reverse_proxy /api/* api:3001
    reverse_proxy web:3000
}

mail.{$DOMAIN} {
    reverse_proxy mailhog:8025
}
```

- [ ] **Step 2: Create `infra/caddy/Dockerfile`**

Exact content:

```dockerfile
FROM caddy:2-alpine
RUN apk add --no-cache bash
COPY Caddyfile /etc/caddy/Caddyfile
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--envfile", "/run/secrets/caddy_env"]
```

- [ ] **Step 3: Verify Caddyfile parses syntactically**

```bash
docker run --rm -v "$PWD/infra/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter ""
```

Expected output (last line):

```
{"level":"info","msg":"valid configuration"}
```

(The `--adapter ""` is required because the default adapter is `caddyfile` but `caddy validate` without `--adapter` picks based on file extension; explicit empty adapter avoids that ambiguity. If this fails, fall back to `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`.)

- [ ] **Step 4: Verify the Dockerfile builds**

```bash
docker build -t ai-padrao-caddy-test infra/caddy
```

Expected output ends with `Successfully tagged ai-padrao-caddy-test`.

- [ ] **Step 5: Commit**

```bash
git add infra/caddy/Caddyfile infra/caddy/Dockerfile
git commit -m "feat(infra): add Caddy reverse proxy image

Caddy terminates TLS automatically via Let's Encrypt HTTP-01. The
Caddyfile reads the domain from an envfile mounted by the compose
override. The 'mail.' subdomain is wired to the Mailhog UI; if
MAILHOG_SUBDOMAIN=false the vhost is dropped at file generation time."
```

---

## Task 4: Compose override for VPS

**Files:**
- Create: `infra/compose/docker-compose.vps.yml`

- [ ] **Step 1: Create `infra/compose/docker-compose.vps.yml`**

Exact content:

```yaml
name: ai-padrao-vps

services:
  postgres:
    env_file:
      - /opt/ai-padrao/infra/.env.production

  api:
    env_file:
      - /opt/ai-padrao/infra/.env.production
    environment:
      NODE_ENV: production
      CORS_ORIGINS: ${WEB_ORIGIN}
    # No `volumes:` block — overrides REPLACE the base `volumes:` list, so by
    # omitting it we drop the bind-mounts of ./apps/api/src and ./apps/api/prisma
    # from the base file. The api image is fully baked at build time in prod.

  web:
    env_file:
      - /opt/ai-padrao/infra/.env.production
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: ${WEB_ORIGIN}
    # Same rule as api: no `volumes:` block here drops the src bind-mounts.
    # .next/standalone output is already baked into the image at build time.

  caddy:
    build: /opt/ai-padrao/repo/infra/caddy
    container_name: ai-padrao-caddy
    restart: unless-stopped
    env_file:
      - /opt/ai-padrao/infra/.env.production
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - web
      - api
    networks:
      - default

volumes:
  caddy_data:
  caddy_config:
```

- [ ] **Step 2: Verify the override parses and merges correctly**

The override references `/opt/ai-padrao/...` paths that exist only on the VPS. To validate the YAML without those paths existing locally, temporarily create stub files and clean up afterwards:

```bash
mkdir -p /tmp/override-validate/opt/ai-padrao/infra /tmp/override-validate/opt/ai-padrao/repo/infra/caddy
touch /tmp/override-validate/opt/ai-padrao/infra/.env.production
echo "FROM scratch" > /tmp/override-validate/opt/ai-padrao/repo/infra/caddy/Dockerfile
docker compose \
  -f docker-compose.yml \
  -f infra/compose/docker-compose.vps.yml \
  --profile dev-tools \
  -p validate-test \
  --project-directory /tmp/override-validate \
  config -q
echo "exit=$?"
rm -rf /tmp/override-validate
```

Expected output: `exit=0` (no error message). If non-zero, fix the YAML syntax and retry.

- [ ] **Step 3: Verify the merged config includes the caddy service**

```bash
mkdir -p /tmp/override-validate/opt/ai-padrao/infra /tmp/override-validate/opt/ai-padrao/repo/infra/caddy
touch /tmp/override-validate/opt/ai-padrao/infra/.env.production
echo "FROM scratch" > /tmp/override-validate/opt/ai-padrao/repo/infra/caddy/Dockerfile
docker compose \
  -f docker-compose.yml \
  -f infra/compose/docker-compose.vps.yml \
  --profile dev-tools \
  -p validate-test \
  --project-directory /tmp/override-validate \
  config --services
rm -rf /tmp/override-validate
```

Expected output contains `caddy` plus the base services:

```
ai-padrao-api
ai-padrao-mailhog
ai-padrao-otel
ai-padrao-postgres
ai-padrao-web
caddy
```

(Exact service names depend on the existing `container_name:` settings; presence of `caddy` is what matters.)

- [ ] **Step 4: Commit**

```bash
git add infra/compose/docker-compose.vps.yml
git commit -m "feat(infra): add compose override for VPS deploy

Production compose profile:
- env_file points at /opt/ai-padrao/infra/.env.production
- binds no src/ to api and web (images are baked)
- NODE_ENV=production on api and web
- NEXT_PUBLIC_API_URL uses the public domain
- adds the caddy service with TLS-terminating 80/443

Bind-mount removal is implicit: omitting the `volumes:` key in the
override replaces the base's bind-mounts (Docker Compose merge
semantics — volumes lists are NOT merged)."
```

---

## Task 5: Smoke test script

**Files:**
- Create: `infra/scripts/smoke-test.sh`

- [ ] **Step 1: Create `infra/scripts/smoke-test.sh`**

Exact content:

```bash
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
```

- [ ] **Step 2: Make executable**

```bash
chmod +x infra/scripts/smoke-test.sh
ls -l infra/scripts/smoke-test.sh
```

Expected: first column ends with `x` (e.g. `-rwxr-xr-x`).

- [ ] **Step 3: Syntax-check the script**

```bash
bash -n infra/scripts/smoke-test.sh && echo "syntax OK"
```

Expected: `syntax OK`. (Bash `-n` parses without executing — catches syntax errors without needing the real env file.)

- [ ] **Step 4: Lint with shellcheck if available**

```bash
if command -v shellcheck >/dev/null; then
  shellcheck infra/scripts/smoke-test.sh && echo "shellcheck OK"
else
  echo "shellcheck not installed, skipping"
fi
```

Expected: either `shellcheck OK` or the skip message. No errors.

- [ ] **Step 5: Commit**

```bash
git add infra/scripts/smoke-test.sh
git commit -m "feat(infra): add post-deploy smoke test

Five checks (TLS handshake, web HTML render, API /health, optional
MailHog UI, Postgres pg_isready) with 60s wait budget. Reads DOMAIN and
MAILHOG_SUBDOMAIN from infra/.env.production. Exit non-zero on any
failure so the GitHub Actions deploy job fails the run."
```

---

## Task 6: Postgres backup script

**Files:**
- Create: `infra/scripts/backup-postgres.sh`

- [ ] **Step 1: Create `infra/scripts/backup-postgres.sh`**

Exact content:

```bash
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
```

- [ ] **Step 2: Make executable**

```bash
chmod +x infra/scripts/backup-postgres.sh
ls -l infra/scripts/backup-postgres.sh
```

Expected: first column ends with `x`.

- [ ] **Step 3: Syntax check**

```bash
bash -n infra/scripts/backup-postgres.sh && echo "syntax OK"
```

Expected: `syntax OK`.

- [ ] **Step 4: Commit**

```bash
git add infra/scripts/backup-postgres.sh
git commit -m "feat(infra): add postgres backup script with rotation

Runs pg_dump via docker compose exec against the production profile,
gzips to infra/data/backups/, and prunes files older than
BACKUP_KEEP_DAYS (default 7). Designed to be invoked from cron hourly
at minute 03."
```

---

## Task 7: Postgres restore script

**Files:**
- Create: `infra/scripts/restore-postgres.sh`

- [ ] **Step 1: Create `infra/scripts/restore-postgres.sh`**

Exact content:

```bash
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
```

- [ ] **Step 2: Make executable**

```bash
chmod +x infra/scripts/restore-postgres.sh
```

- [ ] **Step 3: Syntax check + dry-run help**

```bash
bash -n infra/scripts/restore-postgres.sh && echo "syntax OK"
bash infra/scripts/restore-postgres.sh 2>&1 | head -3
```

Expected first run: `Usage: ...` line and exit. No errors.

- [ ] **Step 4: Commit**

```bash
git add infra/scripts/restore-postgres.sh
git commit -m "feat(infra): add postgres restore script

Reads a .sql.gz produced by backup-postgres.sh and pipes it through
psql in the live postgres container. Requires explicit 'yes' before
writing. Single positional argument = backup file path."
```

---

## Task 8: Deploy script (called by GitHub Actions)

**Files:**
- Create: `infra/scripts/deploy.sh`

- [ ] **Step 1: Create `infra/scripts/deploy.sh`**

Exact content:

```bash
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
```

- [ ] **Step 2: Make executable**

```bash
chmod +x infra/scripts/deploy.sh
```

- [ ] **Step 3: Syntax check**

```bash
bash -n infra/scripts/deploy.sh && echo "syntax OK"
```

Expected: `syntax OK`.

- [ ] **Step 4: Commit**

```bash
git add infra/scripts/deploy.sh
git commit -m "feat(infra): add deploy script for GitHub Actions

Pulls latest main, rebuilds images with --pull, brings the stack up,
waits for postgres, applies Prisma migrations (migrate deploy — not
migrate dev), then runs the smoke test. The git clean skips
.env.production and infra/data/ so local secrets and backups survive."
```

---

## Task 9: VPS bootstrap script

**Files:**
- Create: `infra/scripts/bootstrap-vps.sh`

- [ ] **Step 1: Create `infra/scripts/bootstrap-vps.sh`**

Exact content:

```bash
#!/usr/bin/env bash
# One-time bootstrap of a fresh Ubuntu VPS for ai-padrao deploys.
# Run as root via SSH:
#   scp infra/scripts/bootstrap-vps.sh root@HOST:/tmp/
#   ssh root@HOST "bash /tmp/bootstrap-vps.sh"
#
# Idempotent: re-running on a bootstrapped host is a no-op.

set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:b3ll3o/ai-padrao.git}"
APP_DIR="/opt/ai-padrao"
REPO_DIR="$APP_DIR/repo"
ENV_FILE="$APP_DIR/infra/.env.production"
ENV_EXAMPLE_SRC="$REPO_DIR/infra/.env.production.example"

require_root() {
  if [[ $EUID -ne 0 ]]; then
    echo "FAIL: must run as root" >&2
    exit 1
  fi
}

require_ubuntu() {
  if [[ ! -f /etc/os-release ]]; then
    echo "FAIL: /etc/os-release missing — Ubuntu required" >&2
    exit 1
  fi
  # shellcheck disable=SC1091
  source /etc/os-release
  if [[ "$ID" != "ubuntu" ]]; then
    echo "FAIL: detected distro '$ID' — only Ubuntu is supported" >&2
    exit 1
  fi
  case "$VERSION_ID" in
    22.04|24.04) ;;
    *) echo "FAIL: Ubuntu $VERSION_ID not in supported list (22.04, 24.04)" >&2; exit 1 ;;
  esac
}

ensure_apt_updated() {
  apt update -y && apt upgrade -y
}

ensure_user() {
  if id deploy &>/dev/null; then
    echo "==> user 'deploy' already exists, skipping"
  else
    adduser --disabled-password --gecos "" deploy
    mkdir -p /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    chown -R deploy:deploy /home/deploy/.ssh
  fi
  echo "deploy ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker compose, /usr/bin/systemctl restart docker" \
    > /etc/sudoers.d/deploy
  chmod 440 /etc/sudoers.d/deploy
}

ensure_ssh_hardening() {
  local cfg=/etc/ssh/sshd_config
  sed -i.bak 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$cfg"
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' "$cfg"
  systemctl reload ssh || systemctl reload sshd
}

ensure_ufw() {
  if ufw status | grep -q "Status: active"; then
    echo "==> ufw already active"
    return
  fi
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
}

ensure_fail2ban() {
  if dpkg -s fail2ban >/dev/null 2>&1; then
    echo "==> fail2ban installed"
    return
  fi
  DEBIAN_FRONTEND=noninteractive apt install -y fail2ban
  systemctl enable --now fail2ban
}

ensure_docker() {
  if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
    echo "==> docker already installed"
  else
    apt install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
      > /etc/apt/sources.list.d/docker.list
    apt update -y
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi
  usermod -aG docker deploy
  systemctl enable --now docker
  docker run --rm hello-world >/dev/null
}

ensure_app_dir() {
  mkdir -p "$APP_DIR/infra/data/backups"
  chown -R deploy:deploy "$APP_DIR"
  chmod 700 "$APP_DIR"
}

ensure_repo_clone() {
  if [[ -d "$REPO_DIR/.git" ]]; then
    echo "==> repo already cloned"
    ( cd "$REPO_DIR" && sudo -u deploy git fetch --prune )
    return
  fi
  sudo -u deploy git clone "$REPO_URL" "$REPO_DIR"
}

ensure_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    echo "==> env file exists, skipping generation"
    return
  fi
  if [[ ! -f "$ENV_EXAMPLE_SRC" ]]; then
    echo "FAIL: env example missing at $ENV_EXAMPLE_SRC" >&2
    exit 1
  fi

  read -r -p "DOMAIN (e.g. dev.example.com): " DOMAIN
  read -r -p "LETSENCRYPT_EMAIL: " LETSENCRYPT_EMAIL
  read -r -p "POSTGRES_USER [ai_padrao]: " POSTGRES_USER
  POSTGRES_USER="${POSTGRES_USER:-ai_padrao}"
  read -r -p "POSTGRES_DB [ai_padrao]: " POSTGRES_DB
  POSTGRES_DB="${POSTGRES_DB:-ai_padrao}"

  POSTGRES_PASSWORD=$(openssl rand -base64 48 | tr -d '\n')
  JWT_ACCESS_SECRET=$(openssl rand -base64 48 | tr -d '\n')
  JWT_REFRESH_SECRET=$(openssl rand -base64 48 | tr -d '\n')

  sed \
    -e "s|^DOMAIN=.*|DOMAIN=$DOMAIN|" \
    -e "s|^LETSENCRYPT_EMAIL=.*|LETSENCRYPT_EMAIL=$LETSENCRYPT_EMAIL|" \
    -e "s|^POSTGRES_USER=.*|POSTGRES_USER=$POSTGRES_USER|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|" \
    -e "s|^POSTGRES_DB=.*|POSTGRES_DB=$POSTGRES_DB|" \
    -e "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public|" \
    -e "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET|" \
    -e "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|" \
    -e "s|^CORS_ORIGINS=.*|CORS_ORIGINS=https://$DOMAIN|" \
    -e "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://$DOMAIN|" \
    -e "s|^WEB_ORIGIN=.*|WEB_ORIGIN=https://$DOMAIN|" \
    -e "s|^SMTP_FROM=.*|SMTP_FROM=no-reply@$DOMAIN|" \
    "$ENV_EXAMPLE_SRC" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  chown deploy:deploy "$ENV_FILE"
}

ensure_deploy_key() {
  local keyfile="$APP_DIR/.ssh/id_ed25519_deploy"
  if [[ -f "$keyfile" ]]; then
    echo "==> deploy key already exists"
  else
    sudo -u deploy ssh-keygen -t ed25519 -f "$keyfile" -N ""
  fi
  echo "----- Add this public key as a GitHub deploy key (read-only) -----"
  echo "Repo: $REPO_URL"
  echo "Public key:"
  cat "${keyfile}.pub"
  echo "---------------------------------------------------------------"
}

ensure_stack_up() {
  cd "$REPO_DIR"
  docker compose \
    -f docker-compose.yml \
    -f infra/compose/docker-compose.vps.yml \
    --profile dev-tools \
    up -d --build
  for i in {1..30}; do
    if docker compose \
      -f docker-compose.yml \
      -f infra/compose/docker-compose.vps.yml \
      --profile dev-tools \
      exec -T postgres pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
  docker compose \
    -f docker-compose.yml \
    -f infra/compose/docker-compose.vps.yml \
    --profile dev-tools \
    exec -T api pnpm prisma migrate deploy
  if [[ "${RUN_SEED:-false}" == "true" ]]; then
    docker compose \
      -f docker-compose.yml \
      -f infra/compose/docker-compose.vps.yml \
      --profile dev-tools \
      exec -T api pnpm prisma:seed
  fi
}

ensure_cron() {
  cat > /etc/cron.d/ai-padrao <<'CRON'
03 * * * * deploy /opt/ai-padrao/repo/infra/scripts/backup-postgres.sh >> /var/log/ai-padrao-backup.log 2>&1
0 4 * * 0 root /usr/bin/unattended-upgrade -d
CRON
  chmod 644 /etc/cron.d/ai-padrao
}

warn_dns() {
  local domain="$1"
  local resolved
  resolved=$(getent ahosts "$domain" 2>/dev/null | awk 'NR==1{print $1}')
  local public_ip
  public_ip=$(curl -fsS -m 5 https://ifconfig.me || echo "unknown")
  if [[ -z "$resolved" || "$resolved" != "$public_ip" ]]; then
    echo "WARN: DNS for $domain resolves to '$resolved' but this host's public IP is '$public_ip'." >&2
    echo "      Caddy's Let's Encrypt HTTP-01 challenge will fail until the A record matches." >&2
  else
    echo "==> DNS for $domain -> $public_ip (matches)"
  fi
}

main() {
  require_root
  require_ubuntu
  ensure_apt_updated
  ensure_user
  ensure_ssh_hardening
  ensure_ufw
  ensure_fail2ban
  ensure_docker
  ensure_app_dir
  ensure_repo_clone
  ensure_env_file
  ensure_deploy_key
  ensure_stack_up
  ensure_cron

  # shellcheck disable=SC1090
  source "$ENV_FILE"
  warn_dns "$DOMAIN"

  echo
  echo "Bootstrap complete."
  echo "  Domain:  https://$DOMAIN"
  echo "  Deploy user: deploy (sudo for docker only)"
  echo "  Secrets:  $ENV_FILE (chmod 600)"
  echo "  Backups:  $APP_DIR/infra/data/backups/ (cron @ 03 * * *)"
  echo
  echo "Next steps:"
  echo "  1. Add the public key printed above as a GitHub deploy key (read-only)."
  echo "  2. Add the matching private key to GitHub Secrets as VPS_SSH_KEY."
  echo "  3. Add VPS_HOST, VPS_USER=deploy, SSH_KNOWN_HOSTS to GitHub Secrets."
  echo "  4. Push to main to trigger the first deploy."
}

main "$@"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x infra/scripts/bootstrap-vps.sh
```

- [ ] **Step 3: Syntax check**

```bash
bash -n infra/scripts/bootstrap-vps.sh && echo "syntax OK"
```

Expected: `syntax OK`.

- [ ] **Step 4: Lint with shellcheck**

```bash
if command -v shellcheck >/dev/null; then
  shellcheck infra/scripts/bootstrap-vps.sh
else
  echo "shellcheck not installed, skipping"
fi
```

Expected: no errors (warnings about `source` from dynamic path are OK — see the explicit `disable=SC1090` directives).

- [ ] **Step 5: Commit**

```bash
git add infra/scripts/bootstrap-vps.sh
git commit -m "feat(infra): add one-time VPS bootstrap script

Idempotent: safe to re-run. Performs OS check (Ubuntu 22.04/24.04),
apt upgrade, creates restricted 'deploy' user, hardens sshd, sets up
ufw (22/80/443 only) and fail2ban, installs Docker Engine + Compose v2,
generates infra/.env.production with random secrets, clones the repo
via ssh, generates a deploy keypair, brings the stack up with the
VPS override, applies Prisma migrations, and installs cron jobs.

Run once as root from a fresh VPS:
  scp infra/scripts/bootstrap-vps.sh root@HOST:/tmp/
  ssh root@HOST 'bash /tmp/bootstrap-vps.sh'"
```

---

## Task 10: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy-vps.yml`

- [ ] **Step 1: Create `.github/workflows/deploy-vps.yml`**

Exact content:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [main]
    paths:
      - 'apps/**'
      - 'packages/**'
      - 'infra/**'
      - 'docker-compose.yml'
      - '.github/workflows/deploy-vps.yml'
  workflow_dispatch:

concurrency:
  group: deploy-vps
  cancel-in-progress: false

jobs:
  test:
    runs-on: ubuntu-22.04
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint + typecheck + unit + integration + e2e
        run: pnpm test:all

      - name: Production build smoke
        run: pnpm build

  deploy:
    needs: test
    runs-on: ubuntu-22.04
    timeout-minutes: 15
    environment:
      name: vps-production
      url: https://${{ secrets.VPS_HOST }}/
    steps:
      - uses: actions/checkout@v4

      - name: Configure SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.VPS_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          echo "${{ secrets.SSH_KNOWN_HOSTS }}" > ~/.ssh/known_hosts
          chmod 644 ~/.ssh/known_hosts

      - name: Run deploy script
        run: |
          ssh -o StrictHostKeyChecking=yes \
              ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }} \
              'bash -s' < infra/scripts/deploy.sh

      - name: Deploy summary
        if: always()
        run: |
          echo "Deploy job finished with status: ${{ job.status }}"
          echo "VPS: ${{ secrets.VPS_HOST }}"
          echo "If status is failure, see the deploy.sh output above."
```

- [ ] **Step 2: Validate the workflow YAML**

```bash
if command -v actionlint >/dev/null; then
  actionlint .github/workflows/deploy-vps.yml
else
  python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-vps.yml'))" && echo "yaml OK"
fi
```

Expected: either actionlint clean output, or `yaml OK`. No errors.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-vps.yml
git commit -m "feat(ci): add deploy-to-vps GitHub Actions workflow

Triggered by push to main (filtered to relevant paths) and manual
dispatch. 'test' job runs lint+typecheck+test:all+build on
ubuntu-22.04. 'deploy' job needs test, SSHes into the VPS using a
dedicated deploy key (VPS_SSH_KEY secret), and runs infra/scripts/deploy.sh.
Concurrency group 'deploy-vps' serializes deploys without cancelling
in-progress runs."
```

---

## Task 11: infra/README.md

**Files:**
- Create: `infra/README.md`

- [ ] **Step 1: Create `infra/README.md`**

Exact content:

````markdown
# ai-padrao — VPS deploy infrastructure

All files needed to deploy the `ai-padrao` monorepo to a fresh Ubuntu VPS
are committed in this directory. The deploy is reproducible from a single
bootstrap command and updates are pushed via GitHub Actions.

## Layout

```
infra/
├── README.md                            # this file
├── .env.production.example              # shape of the production env (committed, no secrets)
├── compose/
│   └── docker-compose.vps.yml           # compose override for VPS mode
├── caddy/
│   ├── Caddyfile                        # reverse proxy + TLS auto
│   └── Dockerfile                       # caddy:2-alpine image
└── scripts/
    ├── bootstrap-vps.sh                 # one-time VPS setup (run as root)
    ├── deploy.sh                        # called by GitHub Actions
    ├── smoke-test.sh                    # post-deploy validation
    ├── backup-postgres.sh               # cron-friendly pg_dump
    └── restore-postgres.sh              # manual pg_restore
```

## First-time setup on a fresh VPS

1. Provision an Ubuntu 22.04 or 24.04 LTS server (Hetzner CX22, DigitalOcean
   droplet, etc.).
2. Point a domain's A record to the server's public IP.
3. From your local machine:
   ```bash
   scp infra/scripts/bootstrap-vps.sh root@HOST:/tmp/
   ssh root@HOST "bash /tmp/bootstrap-vps.sh"
   ```
4. The script will:
   - Install Docker + Compose v2, create a `deploy` user, harden SSH,
     set up ufw (22/80/443) and fail2ban.
   - Generate `/opt/ai-padrao/infra/.env.production` with random secrets.
   - Clone the repo via SSH to `/opt/ai-padrao/repo`.
   - Generate a deploy keypair and print the **public key** for you to add
     to GitHub as a read-only deploy key.
   - Bring the stack up and run Prisma migrations.
   - Install cron jobs for hourly backups and weekly security upgrades.

## Configuring GitHub Actions

Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret             | Source                                                        |
|--------------------|---------------------------------------------------------------|
| `VPS_SSH_KEY`      | Contents of `/opt/ai-padrao/.ssh/id_ed25519_deploy` (private) |
| `VPS_HOST`         | Server IP or hostname                                          |
| `VPS_USER`         | `deploy`                                                      |
| `SSH_KNOWN_HOSTS`  | Output of `ssh-keyscan -H $VPS_HOST`                          |

## Deploying

Push to `main` (with changes under `apps/`, `packages/`, `infra/`,
`docker-compose.yml`, or this workflow) → GitHub Actions runs
`pnpm test:all` → on success, runs `infra/scripts/deploy.sh` on the VPS
→ stack rebuilds, migrations apply, smoke test runs.

To deploy manually without a code change: GitHub → Actions → "Deploy to
VPS" → "Run workflow".

## Rollback

Manual. SSH into the VPS and run:

```bash
ssh deploy@HOST
cd /opt/ai-padrao/repo
git log --oneline -10
git reset --hard <last-good-sha>
infra/scripts/deploy.sh
infra/scripts/smoke-test.sh
```

No automatic rollback because Prisma migrations can leave the DB in an
incompatible state. Migrations must be reverted manually if needed.

## Backups

Postgres backups are written to `/opt/ai-padrao/infra/data/backups/` by
the hourly cron job. Files older than `BACKUP_KEEP_DAYS` (default 7) are
pruned automatically.

To restore a backup:

```bash
ssh deploy@HOST
sudo /opt/ai-padrao/repo/infra/scripts/restore-postgres.sh \
  /opt/ai-padrao/infra/data/backups/db-YYYYMMDD-HHMM.sql.gz
```
````

- [ ] **Step 2: Commit**

```bash
git add infra/README.md
git commit -m "docs(infra): document the VPS deploy flow

Explains the layout, the one-time bootstrap, GitHub Secrets setup,
push-to-main deploy flow, manual rollback, and backup/restore usage."
```

---

## Task 12: Root README "Deploy to VPS" section

**Files:**
- Modify: `README.md` (append a "Deploy to VPS" section near the bottom, before any existing footers)

- [ ] **Step 1: Read the current README to find the right insertion point**

```bash
grep -n '^## ' README.md
```

- [ ] **Step 2: Append the "Deploy to VPS" section**

Find the last `##` heading. Append the block below AFTER all existing sections (just before any final horizontal rule or footer if applicable). Use `Edit` with the last existing section as the anchor.

Exact content to append:

````markdown
## Deploy to VPS

The repo ships everything needed to run ai-padrao as a development
environment on a fresh Ubuntu VPS, with HTTPS via Caddy + Let's Encrypt
and deploys triggered by GitHub Actions on push to `main`.

All configuration lives under [`infra/`](infra/) — see
[`infra/README.md`](infra/README.md) for the full flow.

Quick path:

```bash
# 1. Bootstrap a fresh VPS (one time, as root)
scp infra/scripts/bootstrap-vps.sh root@HOST:/tmp/
ssh root@HOST "bash /tmp/bootstrap-vps.sh"

# 2. Add the printed public key as a GitHub deploy key + add VPS secrets
#    (VPS_SSH_KEY, VPS_HOST, VPS_USER, SSH_KNOWN_HOSTS) to the repo

# 3. Push to main — GitHub Actions deploys automatically
git push origin main
```
````

- [ ] **Step 3: Render-check the README**

```bash
test $(wc -l < README.md) -gt 30 && echo "README OK ($(wc -l < README.md) lines)"
```

Expected: `README OK (NN lines)` with `NN > 30`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(root): add 'Deploy to VPS' section

Points to infra/README.md and shows the bootstrap → secrets → push
flow as the user-facing entry point to the VPS deploy feature."
```

---

## Task 13: Final end-to-end validation

**Files:** (none — validation only)

- [ ] **Step 1: Validate base compose + override merge cleanly**

```bash
docker compose --profile dev-tools config -q && echo "base OK"
docker compose \
  -f docker-compose.yml \
  -f infra/compose/docker-compose.vps.yml \
  --profile dev-tools \
  config -q && echo "override OK"
```

Expected: both `OK` messages. (The override validation requires the stubs created in Task 4 Step 2 — recreate them if needed, then clean up.)

- [ ] **Step 2: Validate Caddyfile**

```bash
docker run --rm \
  -v "$PWD/infra/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2-alpine \
  caddy validate --config /etc/caddy/Caddyfile --adapter ""
```

Expected: `{"level":"info","msg":"valid configuration"}`.

- [ ] **Step 3: Bash syntax-check every script**

```bash
for s in infra/scripts/*.sh; do bash -n "$s" && echo "$s: OK"; done
```

Expected: 5 lines, each `: OK`.

- [ ] **Step 4: GitHub Actions YAML parses**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-vps.yml'))" \
  && echo "workflow yaml OK"
```

Expected: `workflow yaml OK`.

- [ ] **Step 5: Run the project's own test suite to ensure no regression**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all three commands exit 0. The infrastructure changes should not affect tests, but this is the regression guard.

- [ ] **Step 6: Confirm the final state**

```bash
git log --oneline -15
```

Expected: 13 commits ahead of the pre-plan `main`, one per task, in order. If any commit is missing, do not add it as a fixup — investigate why and create the missing task explicitly.

- [ ] **Step 7: Final report**

Print a summary for the user:

```bash
echo
echo "=== VPS deploy plan complete ==="
echo "Files created:"
find infra .github/workflows -type f -not -path '*/node_modules/*' | sort
echo
echo "Files modified:"
git diff --name-only HEAD~13 HEAD
echo
echo "DO NOT push to remote unless user requests."
```

This task has no commit of its own — the commits were created task-by-task. The final report is just for the user.

---

## Self-Review Checklist (run after writing)

- [x] **Spec coverage:** every section in the spec maps to a task:
  - §3 (Files) → Tasks 1, 3, 4, 5–9, 10, 11
  - §4 (Bootstrap) → Task 9
  - §5 (GH Actions) → Task 10
  - §6 (Compose override + Caddyfile + Dockerfile) → Tasks 3, 4
  - §7 (Secrets, persistence, backups, OTel, rollback, security) → Tasks 1 (secrets), 6/7 (backups), 9 (security), 10 (rollback via manual)
  - §8 (Smoke test) → Task 5
  - §9 (Testing strategy) → Task 13

- [x] **Placeholder scan:** no TBD/TODO/"implement later"/"add appropriate". Every code block is real.

- [x] **Type consistency:**
  - Script names: `bootstrap-vps.sh`, `deploy.sh`, `smoke-test.sh`, `backup-postgres.sh`, `restore-postgres.sh` — consistent across Tasks 5–9 and referenced by Tasks 8 (deploy.sh), 11 (infra/README.md), 13 (validation).
  - Env var names: `DOMAIN`, `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `BACKUP_KEEP_DAYS`, `MAILHOG_SUBDOMAIN`, `RUN_SEED`, `LETSENCRYPT_EMAIL`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`, `WEB_ORIGIN`, `SMTP_FROM` — consistent across Tasks 1, 5, 6, 7, 8, 9.
  - Compose files: `docker-compose.yml` + `infra/compose/docker-compose.vps.yml` + `--profile dev-tools` — consistent across Tasks 2, 4, 5, 6, 7, 8, 9, 13.
  - Volume mount paths: `/opt/ai-padrao/infra/.env.production`, `/opt/ai-padrao/repo`, `/opt/ai-padrao/infra/data/backups` — consistent.
  - GitHub Secrets: `VPS_SSH_KEY`, `VPS_HOST`, `VPS_USER`, `SSH_KNOWN_HOSTS` — consistent across Tasks 10 and 11.

- [x] **No silent file conflicts:** every `Create:` path is unique; every `Modify:` path is referenced exactly once.

---

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `docs/superpowers/plans/2026-09-09-vps-deploy.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?"**