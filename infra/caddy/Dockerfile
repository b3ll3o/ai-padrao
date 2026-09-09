FROM caddy:2-alpine
RUN apk add --no-cache bash
COPY Caddyfile /etc/caddy/Caddyfile.tpl
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]
