#!/usr/bin/env bash
# Renders /etc/caddy/Caddyfile from the template at /etc/caddy/Caddyfile.tpl,
# then execs caddy. The MAILHOG_SUBDOMAIN env var (loaded from
# /run/secrets/caddy_env) controls whether the mail.{$DOMAIN} vhost block is
# included. When the flag is anything other than "true", the block is removed
# so Caddy never tries to obtain a certificate for a hostname that may not
# exist in DNS.

set -euo pipefail

# Source the secrets env file so MAILHOG_SUBDOMAIN is available to this script.
# Caddy itself also reads this file via --envfile later.
if [[ -f /run/secrets/caddy_env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /run/secrets/caddy_env
  set +a
fi

MAILHOG_SUBDOMAIN="${MAILHOG_SUBDOMAIN:-false}"

if [[ "$MAILHOG_SUBDOMAIN" == "true" ]]; then
  # Keep the mail block; only strip the marker comments.
  sed -e '/# BEGIN MAIL BLOCK/d' -e '/# END MAIL BLOCK/d' \
    /etc/caddy/Caddyfile.tpl > /etc/caddy/Caddyfile
else
  # Drop the mail block entirely (markers + content between).
  sed '/# BEGIN MAIL BLOCK/,/# END MAIL BLOCK/d' \
    /etc/caddy/Caddyfile.tpl > /etc/caddy/Caddyfile
fi

exec caddy run --config /etc/caddy/Caddyfile --envfile /run/secrets/caddy_env
