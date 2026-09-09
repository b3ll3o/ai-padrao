# ADR-015: Bind-mount `apps/api/prisma/` into the api container

- **Status:** Accepted
- **Date:** 2026-08-05
- **Decision type:** Bug-driven architecture decision
- **Related ADRs:** [ADR-004](./ADR-004-dockerfile-copy-schema-before-generate.md), [ADR-006](./ADR-006-nest-logger-not-console.md)

## Context

The api service in `docker-compose.yml` is a dev container that runs `pnpm dev` and connects to the sibling `postgres` container. To support hot-reload of source edits, the api service bind-mounts:

- `./apps/api/src` → `/app/apps/api/src`
- `./packages` → `/app/packages`

Inside the container, anything not under those mounts comes from the Docker image baked at the most recent `docker compose up --build`. `apps/api/prisma/` was NOT in the bind-mount list, so the container always saw the image-baked `schema.prisma` + `migrations/`.

That worked fine while schema changes were rare and migrations were always shipped with a container rebuild. After the `domain-audit-foundation` change landed a fresh migration (`20260805000000_domain_audit`) on the host filesystem, the next `pnpm db:migrate` — which runs `prisma migrate dev` inside the api container — saw:

- Container-side migrations dir: only `20260804151936_init` (the image was 23 hours old).
- Live DB: the audit migration was already applied (from feature-branch development).

Prisma correctly reported that something was inconsistent and (incorrectly) recommended `prisma migrate reset`. The DB was actually healthy — `_prisma_migrations` showed both migrations applied, the `users_history` table and `AuditOp` enum were present, and the `users.deleted_at` + `users.version` columns existed. Only the container's view of `migrations/` was stale.


## Decision

Add `./apps/api/prisma:/app/apps/api/prisma` to the `api` service's `volumes:` block in `docker-compose.yml`. This makes the host's live `schema.prisma` and `migrations/` visible inside the container, matching the hot-reload pattern already used for `apps/api/src`.

After the bind mount is in place, a one-time `docker compose up -d --build api` rebuild is required so the new mount takes effect. After that, schema and migration edits propagate to the container without further rebuilds — same hot-reload contract as the rest of the api surface.

## Consequences

Positive:

- `prisma migrate dev` inside the container always sees the same `migrations/` directory as the host. No more phantom drift.
- A future contributor can land a new migration locally without rebuilding the api container first.
- The pattern is now uniform across the api container's hot-reload surface (`src/`, `prisma/`, plus the shared `packages/` mount).
- Drift-class incidents stop recurring at the source.

Negative:

- The bind mount must be preserved. A future maintainer who removes it (e.g. trying to "clean up" the volumes block) would re-introduce the drift class.
- `prisma generate` at container start reads from the bind-mounted `schema.prisma`. If the schema is broken, the container fails to start — but this is the same behaviour we already accept for `apps/api/src` (a broken `main.ts` also fails to start), so it's not a new failure mode.
- The bind mount covers the whole `apps/api/prisma/` subtree, including `seed.ts`. This is fine for dev (seed runs at image build time AND in tests) but means a hostile local write to `seed.ts` would propagate. Acceptable risk: the dev container is not a security boundary.

## Enforcement

1. The drift-smoke-test addition (`prisma migrate status` after `docker compose up`) would catch a regression in CI before it reaches `main`.
2. The bind mount lives in a single, easy-to-spot line of `docker-compose.yml`. Code review of any change to the api service's `volumes:` block must confirm the `./apps/api/prisma` mount is still present.
3. No `.skip` tests (ADR-007) — any test added for the drift class must run for real, not be silenced.

## References

- `docker-compose.yml` — the `api` service `volumes:` block, specifically the new `./apps/api/prisma:/app/apps/api/prisma` entry.
- `apps/api/prisma/migrations/20260805000000_domain_audit/migration.sql` — the migration that surfaced the gap.
