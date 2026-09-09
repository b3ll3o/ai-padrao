FROM caddy:2-alpine
RUN apk add --no-cache bash
COPY Caddyfile /etc/caddy/Caddyfile
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--envfile", "/run/secrets/caddy_env"]