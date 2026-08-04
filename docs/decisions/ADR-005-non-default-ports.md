# ADR-005 — Non-default host ports in `docker-compose.yml`

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-008 (full context in `.harness/INCIDENTS.md`)

## Context

`docker-compose.yml` defaults `1025:1025` and `8025:8025` for MailHog (SMTP

- web UI). These are well-known ports that any local SMTP client or
  browser session collides with. When a developer already runs Mailhog or
  a corporate relay on those ports, the bind fails silently and the
  container exits without surfacing the cause. Onboarding documents had
  been written assuming "MailHog is at 8025" — and that assumption was
  true on the original author's machine only.

## Decision

Host-side ports in `docker-compose.yml` MUST be off-default for any
service whose upstream default would collide with other local tooling:

```yaml
services:
  mailhog:
    ports:
      - "11025:1025" # SMTP — off-default on the host
      - "18025:8025" # Web UI — off-default on the host
```

Pick a host port ≥ 10000 to keep the change obvious. Document the actual
host port in `.env.example` and in the project's `README.md` quickstart.
Do not bind to the upstream default on the host even if the container
default is the same.

## Consequences

- **Easier:** New contributors don't collide with already-running
  services. Port-mismatch failures become obvious.
- **Harder:** The "what port is MailHog on?" question requires reading
  the README instead of guessing 8025.
- **Trade-off:** Accept — local-port collisions have wasted hours across
  the team; this is a one-time change.

## Enforcement

- Auto-check **INC-008** in `.harness/check.sh` greps `docker-compose.yml`
  for `^\s+-\s+"(1025|8025):` and fails on any match.
- Skill: `pnpm-monorepo-script-pitfalls` Pitfall 5.
- Codemod: `.harness/codemods/inc-008-non-default-ports.py` proposes
  port remapping for offending services.
