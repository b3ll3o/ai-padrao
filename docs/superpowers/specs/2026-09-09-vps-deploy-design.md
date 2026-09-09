# ai-padrao VPS Deploy (Dev Environment) — Design Spec

**Date**: 2026-09-09
**Status**: Draft (awaiting user review)
**Owner**: leo
**Project**: `ai-padrao` (monorepo at `/home/leo/Documentos/projetos/padrao`)

---

## 1. Purpose

Promote the `ai-padrao` monorepo from "runs locally via `pnpm up`" to **"deploys to a fresh Ubuntu VPS as an externally accessible development environment, with all configuration committed to the repository and reproducible from a single bootstrap command."**

The deployed environment is **not production** — it is a development environment that other people (the team, stakeholders) can reach via a real domain + TLS. Service parity with local dev is intentional: keep MailHog + OpenTelemetry so the same flows that run locally run on the VPS.

### 1.1 Out of scope

- Production hardening (HA Postgres, replicas, blue/green deploys, autoscaling, WAF, SOC2 controls).
- Multiple environments (staging, preview). Only **one VPS environment** is in scope.
- Migrating the deploy flow away from Docker Compose to Kubernetes / Nomad.
- CI for the VPS provisioning step itself (the `bootstrap-vps.sh` is run by hand once).
- Replacing MailHog with a real SMTP provider.
- External uptime monitoring (UptimeRobot / Better Stack) — listed as a future task but not implemented.
- Loki / Promtail / centralized log aggregation.

---

## 2. Architecture Overview

### 2.1 Topology

```
GitHub (repo ai-padrao, branch main)
   │  push (or workflow_dispatch)
   ▼
GitHub Actions runner
   │  job: test (pnpm test:all)
   │  job: deploy (ssh deploy@VPS ...)
   ▼
VPS (Ubuntu 22.04 or 24.04 LTS, Docker Engine + Compose v2)
   │
   ├─ /opt/ai-padrao/
   │   ├─ repo/                ← clone do GitHub (atualizado por git pull)
   │   │   ├─ infra/           ← compose override, Caddyfile, scripts, .env.production.example
   │   │   ├─ apps/, packages/ ← código-fonte (já baked nas imagens em prod)
   │   │   ├─ docker-compose.yml
   │   │   └─ .git/...
   │   ├─ infra/
   │   │   ├─ .env.production  ← segredos reais, chmod 600, gitignored
   │   │   └─ data/backups/    ← pg_dump.gz, rotação 7 dias
   │   └─ .ssh/                ← chave privada + authorized_keys
   │
   ├─ Docker Compose stack (override + base)
   │   ├─ postgres (volume: pgdata)
   │   ├─ api    (baked image, sem bind-mount de src)
   │   ├─ web    (baked standalone, sem bind-mount de src)
   │   ├─ otel-collector (profile: dev-tools)
   │   ├─ mailhog         (profile: dev-tools)
   │   └─ caddy           (80/443 → reverse proxy, TLS via Let's Encrypt HTTP-01)
   │
   ├─ ufw firewall  (allow 22/80/443, deny rest)
   └─ fail2ban       (proteção brute-force SSH)
```

### 2.2 Decision: Abordagem A — single compose + override

A single `docker-compose.yml` (already at repo root) is the source of truth for the service graph. The VPS adds an **override file** at `infra/compose/docker-compose.vps.yml` that:

- Swaps `env_file: .env` → `env_file: infra/.env.production`.
- Removes bind-mounts of `./apps/*/src` and `./apps/api/prisma` (production has no hot-reload).
- Adds the `caddy` service.
- Activates `--profile dev-tools` so MailHog + OTel remain available (per user requirement).

### 2.3 Service parity with local dev

| Service         | Local dev            | VPS                        |
|-----------------|----------------------|----------------------------|
| postgres        | volume + dev creds   | volume + prod creds        |
| api             | bind-mount src/      | baked image, no bind-mount |
| web             | bind-mount src/      | baked standalone image     |
| otel-collector  | dev-tools profile    | dev-tools profile          |
| mailhog         | dev-tools profile    | dev-tools profile          |
| caddy           | n/a                  | new in VPS override        |

### 2.4 Why no Cloudflare / DNS-01 challenge

The VPS will not be fronted by Cloudflare. TLS terminates at Caddy on the VPS using **HTTP-01 challenge** (the Caddy default). This requires port 80 reachable from the internet, which is already in ufw's allow list. No DNS provider credentials are needed in `.env.production`.

---

## 3. New & Changed Files

All paths are relative to repo root `/home/leo/Documentos/projetos/padrao/`.

### 3.1 Created

```
infra/
├── README.md                                    # como usar a pasta infra/
├── .env.production.example                      # shape do env, sem segredos
├── compose/
│   └── docker-compose.vps.yml                   # override (Abordagem A)
├── caddy/
│   ├── Caddyfile                                # vhost + reverse proxy
│   └── Dockerfile                               # caddy:2-alpine custom (para env file)
└── scripts/
    ├── bootstrap-vps.sh                         # idempotente, executado UMA vez
    ├── deploy.sh                                # chamado pelo GH Actions
    ├── smoke-test.sh                            # valida pós-deploy
    ├── backup-postgres.sh                       # cron-friendly
    └── restore-postgres.sh                      # manual, a partir de um .sql.gz

.github/workflows/
└── deploy-vps.yml                               # push-to-main + workflow_dispatch
```

### 3.2 Modified

```
.gitignore                                       # adicionar:
                                                  #   .env.production
                                                  #   infra/data/
                                                  #   *.pem
                                                  #   infra/.env.production
README.md                                         # seção "Deploy to VPS"
docker-compose.yml                               # adicionar profile: [dev-tools]
                                                  #   aos serviços otel-collector e mailhog
                                                  #   (mantém comportamento atual em
                                                  #   dev local, ativa em prod com
                                                  #   --profile dev-tools)
```

### 3.3 NOT in repo (stay on the VPS only)

- `/opt/ai-padrao/infra/.env.production` — real secrets, generated by bootstrap.
- `/opt/ai-padrao/infra/data/backups/*.sql.gz` — Postgres dumps.
- `/opt/ai-padrao/.ssh/id_ed25519_deploy` — private key paired with GH Actions secret.
- GitHub Secrets: `VPS_SSH_KEY`, `VPS_HOST`, `VPS_USER`, `SSH_KNOWN_HOSTS`.

---

## 4. VPS Bootstrap (`infra/scripts/bootstrap-vps.sh`)

**Invocation (one-time, manual):**

```bash
scp infra/scripts/bootstrap-vps.sh root@IP_DA_VPS:/tmp/
ssh root@IP_DA_VPS "bash /tmp/bootstrap-vps.sh"
```

The script is **idempotent**: re-running it on an already-bootstrapped VPS is a no-op (or up to a printed warning). Every step has a guard.

**Steps:**

1. **OS detection & apt upgrade**
   - Detects Ubuntu22.04 or 24.04 LTS via `/etc/os-release`. Aborts on anything else.
   - `apt update && apt upgrade -y`.

2. **User `deploy`**
   - Creates `deploy` with home `/home/deploy`, shell `/bin/bash`.
   - Adds `deploy` to group `docker` (created later in step 4).
   - Installs `/etc/sudoers.d/deploy` with `NOPASSWD: /usr/bin/docker, /usr/bin/docker compose, /usr/bin/systemctl restart docker`.
   - Password auth disabled in `/etc/ssh/sshd_config` (key-only).

3. **Firewall (ufw)**
   - `ufw default deny incoming`
   - `ufw allow 22/tcp` (or restricted to GitHub Actions IP ranges if provided)
   - `ufw allow 80/tcp`, `ufw allow 443/tcp`
   - `ufw --force enable`

4. **fail2ban**
   - `apt install fail2ban -y` with default SSH jail enabled.

5. **Docker Engine + Compose v2**
   - Adds Docker apt repo, installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, `docker-compose-plugin`.
   - `systemctl enable --now docker`.
   - Sanity check: `docker run --rm hello-world`.

6. **App directory & secrets**
   - `mkdir -p /opt/ai-padrao/infra/data/backups`
   - `chown -R deploy:deploy /opt/ai-padrao`
   - Generates `infra/.env.production` from `.env.production.example`:
     - Prompts interactively for: `DOMAIN`, `LETSENCRYPT_EMAIL`, `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
     - Secrets not prompted (JWT secrets, POSTGRES_PASSWORD) are generated via `openssl rand -base64 48`.
     - File written with `chmod 600`.

7. **GitHub deploy key**
   - Generates `ssh-keygen -t ed25519 -f /opt/ai-padrao/.ssh/id_ed25519_deploy -N ""`.
   - Prints the **public key** with instructions to add it to the GitHub repo as a deploy key with read access.
   - Does **NOT** automatically configure access to `github.com` (assumes the repo is public OR the user will add the public key manually).

8. **Initial stack up**
   - `cd /opt/ai-padrao/repo` (cloned in next step; if absent, error).
   - `docker compose -f docker-compose.yml -f infra/compose/docker-compose.vps.yml --profile dev-tools up -d --build`.
   - `docker compose exec -T api pnpm prisma migrate deploy` (idempotent).
   - If `RUN_SEED=true` in env, runs `docker compose exec -T api pnpm prisma:seed`.

9. **Cron jobs** (deployed as files in `/etc/cron.d/ai-padrao`)
   - `03 * * * * deploy /opt/ai-padrao/repo/infra/scripts/backup-postgres.sh`
   - `0 4 * * 0 root /usr/bin/unattended-upgrade -d` (security-only)

10. **Smoke test**
    - Runs `infra/scripts/smoke-test.sh` against the configured `DOMAIN`.
    - If smoke fails, prints the failed checks and exits non-zero so the user can investigate.

11. **Final report**
    - Prints: domain URL, IP, deploy user, where secrets live, where backups go, how to trigger a deploy.

**Pre-conditions enforced by the script:**
- Run as `root` over SSH.
- DNS A record for `${DOMAIN}` must resolve to this VPS's public IP (warns if not, proceeds anyway since Caddy will retry).
- Required ports (22/80/443) reachable from outside (script does a `curl -m 5 ifconfig.me` to confirm egress).

---

## 5. GitHub Actions Deploy Workflow

**File:** `.github/workflows/deploy-vps.yml`

### 5.1 Triggers

```yaml
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
```

### 5.2 Jobs

**Job `test`** (Ubuntu runner, Node 22, pnpm 9 via corepack):

1. Checkout with `fetch-depth: 0`.
2. `pnpm install --frozen-lockfile`.
3. `pnpm test:all` (lint + typecheck + unit + integration + e2e).
4. `pnpm build` (smoke check that production build succeeds).

**Job `deploy`** (`needs: test`, same runner, sequential):

1. SSH config:
   - Write `VPS_SSH_KEY` to `~/.ssh/id_ed25519`, `chmod 600`.
   - Write `SSH_KNOWN_HOSTS` to `~/.ssh/known_hosts`.

2. Run `infra/scripts/deploy.sh` over SSH:
   ```bash
   ssh deploy@${VPS_HOST} 'bash -s' < infra/scripts/deploy.sh
   ```

   Inside `deploy.sh`:
   - `cd /opt/ai-padrao/repo`
   - `git fetch --prune`
   - `git reset --hard origin/main`
   - `docker compose -f docker-compose.yml -f infra/compose/docker-compose.vps.yml --profile dev-tools build --pull`
   - `docker compose ... up -d`
   - `docker compose exec -T api pnpm prisma migrate deploy`
   - `infra/scripts/smoke-test.sh`

3. On smoke failure: log the failed URLs, set job status to failure. **No automatic rollback** (see §7).

### 5.3 Branch protection

`main` is configured to require the `test` job as a required status check. This is a repo-settings change; the workflow does not enforce it but the spec documents the expectation.

### 5.4 Required GitHub Secrets

| Secret             | Purpose                                              |
|--------------------|------------------------------------------------------|
| `VPS_SSH_KEY`      | Private key matching the `deploy` user's authorized_keys |
| `VPS_HOST`         | IP or hostname of VPS                                |
| `VPS_USER`         | `deploy`                                            |
| `SSH_KNOWN_HOSTS`  | Output of `ssh-keyscan -H $VPS_HOST` (one-time)      |

---

## 6. Compose Override Details

### 6.1 `infra/compose/docker-compose.vps.yml`

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
    build:
      context: /opt/ai-padrao/repo/infra/caddy
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

**Note:** bind-mount removal in Compose overrides requires re-declaring the `volumes:` list on the service. The full override file lists every volume that should remain (just the named volumes `pgdata`, `api_*_node_modules` are dropped because production doesn't need hot-reload node_modules).

### 6.2 `infra/caddy/Caddyfile`

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

- TLS automatic via Let's Encrypt HTTP-01 (default).
- `{$DOMAIN}` is interpolated by Caddy from the env file (Caddy supports env placeholders in the Caddyfile when run with `caddy run --envfile ...`; the custom Dockerfile in `infra/caddy/Dockerfile` invokes this).
- The `mail.` subdomain is optional and configurable via `MAILHOG_SUBDOMAIN=true` env var; if disabled, the `mail.` block is omitted at file-generation time by the bootstrap.

### 6.3 `infra/caddy/Dockerfile`

```dockerfile
FROM caddy:2-alpine
RUN apk add --no-cache bash
COPY Caddyfile /etc/caddy/Caddyfile
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--envfile", "/run/secrets/caddy_env"]
```

Caddy reads env vars from `--envfile`. The override mounts `infra/.env.production` into `/run/secrets/caddy_env:ro`.

---

## 7. Operational Details

### 7.1 Secrets (`infra/.env.production`)

Required variables (see `.env.production.example` for canonical list):

| Var                   | Source                              |
|-----------------------|-------------------------------------|
| `DOMAIN`              | user input (prompted)               |
| `LETSENCRYPT_EMAIL`   | user input (prompted)               |
| `POSTGRES_USER`       | `ai_padrao`                         |
| `POSTGRES_PASSWORD`   | `openssl rand -base64 48`           |
| `POSTGRES_DB`         | `ai_padrao`                         |
| `JWT_ACCESS_SECRET`   | `openssl rand -base64 48`           |
| `JWT_REFRESH_SECRET`  | `openssl rand -base64 48`           |
| `JWT_ACCESS_TTL`      | `15m`                               |
| `JWT_REFRESH_TTL`     | `7d`                                |
| `WEB_ORIGIN`          | `https://${DOMAIN}`                 |
| `API_INTERNAL_URL`    | `http://api:3001`                   |
| `NEXT_PUBLIC_API_URL` | `https://${DOMAIN}`                 |
| `CORS_ORIGINS`        | `https://${DOMAIN}`                 |
| `NODE_ENV`            | `production`                        |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector:4318` |
| `OTEL_SERVICE_NAME`   | `ai-padrao`                         |
| `SMTP_HOST`           | `mailhog`                           |
| `SMTP_PORT`           | `1025`                              |
| `RUN_SEED`            | `false` (set `true` on first deploy)|

File permissions: `chmod 600`, owned by `deploy:deploy`. Never committed.

### 7.2 Persistence

- `pgdata` (Postgres) — Docker named volume.
- `caddy_data`, `caddy_config` — Docker named volumes (preserve TLS certs across container restarts).
- `infra/data/backups/` — host directory, mounted into the `api` container only for restore operations (not for backup; backup runs via `docker compose exec postgres pg_dump ...`).

### 7.3 Backups

`infra/scripts/backup-postgres.sh`:
- `docker compose exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > /opt/ai-padrao/infra/data/backups/db-$(date +%Y%m%d-%H%M).sql.gz`
- Prunes files older than `BACKUP_KEEP_DAYS` (default 7).
- Cron: hourly at minute 03.

`infra/scripts/restore-postgres.sh`:
- Takes a backup file path as `$1`.
- `gunzip -c $1 | docker compose exec -T postgres psql -U $POSTGRES_USER $POSTGRES_DB`
- Confirms with user before destructive operation.

### 7.4 Observability

- OTel collector present in both dev and prod via `--profile dev-tools`.
- The base `infra/otel-collector.yaml` exports to `debug` exporter. In prod, the override **does not** change the collector config — the user can switch to an OTLP backend by editing `infra/otel-collector.yaml` (already on the host volume). This is a manual step.
- Logs: `docker compose logs -f --tail=100 <service>` is the standard.

### 7.5 Rollback

Manual via SSH:
```bash
ssh deploy@VPS
cd /opt/ai-padrao/repo
git log --oneline -10       # find last good SHA
git reset --hard <sha>
infra/scripts/deploy.sh
infra/scripts/smoke-test.sh
```

**No automatic rollback** on deploy failure because:
- A failed deploy might have applied a Prisma migration. Rolling back the app code without rolling back the migration leaves the DB in an incompatible state.
- Migration rollback is out of scope for this design (would require a separate migration-revert flow).

### 7.6 Security checklist

- [x] `deploy` user without password, sudo restricted to `docker` + `systemctl restart docker`.
- [x] SSH key-only auth; root login disabled.
- [x] ufw default deny; only 22/80/443 open.
- [x] fail2ban active for SSH jail.
- [x] `.env.production` chmod 600, owned by `deploy`.
- [x] All secrets generated via `openssl rand -base64 48` (not human-chosen).
- [x] Caddyfile blocks `/.env`, `/.git`, `/admin` via `respond` directive (added in design).
- [x] GitHub Actions SSH key has read-only access to the repo (deploy key).
- [x] Prisma migrations run with `migrate deploy` (idempotent, no dev-only auto-revert).
- [ ] **NOT in scope:** rate limiting at app level (already covered by `@nestjs/throttler` in the existing code), secrets rotation policy, intrusion detection beyond fail2ban.

---

## 8. Smoke Test (`infra/scripts/smoke-test.sh`)

Asserts the following within a 60-second budget:

1. **TLS handshake**: `curl -fsSI https://${DOMAIN}/` returns 200.
2. **Web root**: `curl -fsSL https://${DOMAIN}/` contains `<title>` and a Next.js server-rendered chunk.
3. **API health**: `curl -fsS https://${DOMAIN}/api/v1/health` returns JSON with `{ "status": "ok" }`.
4. **MailHog UI** (if `MAILHOG_SUBDOMAIN=true`): `curl -fsSI https://mail.${DOMAIN}/` returns 200.
5. **Postgres reachable** from the host compose network: `docker compose exec -T postgres pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` exits 0 (the api inherits this connection via `DATABASE_URL`, so a healthy postgres implies the api can talk to it).

Any failure exits non-zero. Failure output is captured by the GH Actions job and surfaced in the workflow run.

---

## 9. Testing Strategy

The deploy infrastructure itself is **not unit-tested** (it's glue code). Validation is by execution:

| Validation                          | How                                                    |
|-------------------------------------|--------------------------------------------------------|
| Compose override is valid           | `docker compose -f docker-compose.yml -f infra/compose/docker-compose.vps.yml --profile dev-tools config` (no syntax errors) |
| Bootstrap script runs on clean VPS  | Manual test on a throwaway VPS (Hetzner CX22 or equivalent) |
| Caddyfile compiles                  | `docker run --rm -v $PWD/infra/caddy/Caddyfile:/etc/caddy/Caddyfile caddy:2 caddy validate --config /etc/caddy/Caddyfile` |
| GitHub Actions workflow parses      | `act -j test` (local, no deploy job) |
| Migrations apply cleanly            | Run `prisma migrate deploy` against a fresh DB in CI smoke run |
| Smoke test passes against real DNS  | End-to-end on the real VPS                              |

A pre-commit hook or CI job should run `docker compose ... config` to catch compose syntax errors before they reach the VPS.

---

## 10. Open Decisions (resolved during brainstorming)

| Question                                          | Decision                                                          |
|---------------------------------------------------|-------------------------------------------------------------------|
| VPS management style                              | Bare VPS + SSH (no Coolify/Dokku/Portainer)                       |
| TLS                                               | Caddy + Let's Encrypt HTTP-01                                     |
| Deploy flow                                       | GitHub Actions on push to main                                    |
| Secrets                                           | `.env.production` on server + `.env.production.example` in repo   |
| Dev tooling on VPS                                | Keep MailHog + OTel (via `--profile dev-tools`)                   |
| Compose layout (A/B/C)                           | **A** — single base + override                                    |
| DNS provider                                      | None (no Cloudflare), HTTP-01 challenge                           |
| OS target                                         | Ubuntu 22.04 or 24.04 LTS (detected by script)                    |
| DNS pre-check                                     | Bootstrap warns if DNS not resolving; proceeds anyway             |

---

## 11. References

- Existing project docs:
  - [ARCHITECTURE.md](../../../ARCHITECTURE.md)
  - [CONTRIBUTING.md](../../../CONTRIBUTING.md)
  - [README.md](../../../README.md)
  - [.openspec/AGENTS.md](../../../.openspec/AGENTS.md)
- Existing compose: [docker-compose.yml](../../../docker-compose.yml)
- Memory:
  - [[ai-padrao-blueprint-shape]] — final repo layout
  - [[sdd-subagent-workflow]] — SDD/SDA do/don't from the blueprint build
- External:
  - Caddy HTTP-01 challenge: https://caddyserver.com/docs/automatic-https
  - Docker Compose profiles: https://docs.docker.com/compose/profiles/
  - Docker Compose override: https://docs.docker.com/compose/multiple-compose-files/merge/