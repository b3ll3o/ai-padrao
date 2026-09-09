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
/opt/ai-padrao/repo/infra/scripts/restore-postgres.sh \
  /opt/ai-padrao/infra/data/backups/db-YYYYMMDD-HHMM.sql.gz
```
