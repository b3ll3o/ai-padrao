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
  # Filter to IPv4 only — getent ahosts returns both A and AAAA records and
  # the order is implementation-defined. We compare against ifconfig.me
  # which is IPv4-only, so an AAAA record would always appear mismatched.
  resolved=$(getent ahosts "$domain" 2>/dev/null | awk 'NR==1 && $1 !~ /:/ {print $1}')
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