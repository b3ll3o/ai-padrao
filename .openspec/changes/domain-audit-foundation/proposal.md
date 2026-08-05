# Proposal: Domain Audit Foundation

**Author:** Claude
**Date:** 2026-08-05
**Status:** Approved (designed via brainstorming on 2026-08-05)

## Why

`apps/api` domain entities today carry only `id`, `createdAt`, and `updatedAt`. There is no soft-delete, no version, and no history. Recovery from accidental deletes is impossible, and audit questions like "what did this user look like three edits ago?" cannot be answered.

We want every domain entity (now: `User`; future: every new bounded context) to carry: `id`, `createdAt`, `updatedAt`, `deletedAt`, `version`, plus a typed `<entity>_history` table.

## What changes

- `User` Prisma model gains `deletedAt: DateTime?` and `version: Int @default(0)` columns.
- New `UserHistory` Prisma model with `originalId`, `version`, `operation`, `changedAt`, `changedBy?`, `snapshot Json`. Indexed by `(originalId, version)` and `changedAt`.
- New `AuditOp` enum: `CREATE`, `UPDATE`, `DELETE`, `RESTORE`.
- New Prisma Client extension at `apps/api/src/infra/prisma/audit/audit-extension.ts` that:
  - Filters `user.*` reads by `deletedAt: null` (unless `__includeDeleted: true`).
  - Replaces `user.delete` with `UPDATE … SET deleted_at = now(), version = version + 1` + a `DELETE` history entry.
  - Wraps `user.update`/`upsert` in a transaction that reads the prior row, increments `version`, and writes a history entry with the prior snapshot.
  - Wraps `user.create` to also write a `CREATE` history entry.
- `User` domain entity gains `deletedAt`, `version` readonly fields plus `markDeleted(at)` and `restore()` factory methods.
- `UserRepositoryPort` gains `findByIdIncludingDeleted`, `softDelete(id, actorId?)`, `restore(id, actorId?)`, `getHistory(id)`.
- New `RestoreUserUseCase` and `GetUserHistoryUseCase`.
- `RemoveUserUseCase` now calls `repository.softDelete(id, actor.id)` instead of `delete(id)`.
- `UsersHttpController` gains `PATCH /api/users/:id/restore` (admin) and `GET /api/users/:id/history` (admin).
- New domain error `UserNotDeletedError` (HTTP 409).
- New migration with backfill of one `CREATE` history row per existing user.

## Impact

### Users

- `DELETE /api/users/:id` now soft-deletes; the row remains in the DB but disappears from list/get. Restoring is possible via the new admin endpoint.
- New admin endpoints `PATCH /api/users/:id/restore` and `GET /api/users/:id/history` provide recoverability and audit trail.

### System

- Prisma schema gains 2 columns on `users`, 1 new table `users_history`, 1 new enum `AuditOp`, 1 new index.
- New module `apps/api/src/infra/prisma/audit/`.
- New Prisma Client extension wired in `prisma.module.ts`.
- New error class `UserNotDeletedError`.
- `User` entity and `UserDto` (via mapper) gain 2 new fields.
- Migrations are written to `apps/api/prisma/migrations/<ts>_domain_audit/`.

### Other features

- The auth context (`RefreshToken`, JWT issuance, etc.) is **not** affected. `RefreshToken` stays as-is.
- The web app (`apps/web`) is not affected.
- Future bounded contexts must include the model name in `AUDITED_MODELS` (enforced by ADR-014).

## Out of scope

- Audit applied to `RefreshToken`.
- Field-level diffs (we snapshot the full row into JSON).
- `If-Match` ETag / optimistic-concurrency HTTP surface.
- Audit-log streaming via OpenTelemetry.
- DB-level immutability of `users_history` (revoke UPDATE/DELETE on the history table).
- Promoting this foundation beyond `User` to other bounded contexts.

## Risks

| Risk | Mitigation |
| --- | --- |
| `$extends` misses a query path (e.g. raw SQL) | Repository port documents `findByIdIncludingDeleted`; raw SQL is forbidden in app code |
| Backfill script fails partway through existing DB | Migration runs in a single transaction; if backfill fails, the migration rolls back |
| Soft-deleted rows leak into `list()` | Extension filters on `findMany`; unit + e2e tests assert absence |
| New code paths reduce coverage below 80% | Coverage gate fails CI; explicit test additions in tasks.md |
| OpenSpec change collides with another in-flight change | Branch `feat/domain-audit-foundation` is isolated; rebased once before merge |