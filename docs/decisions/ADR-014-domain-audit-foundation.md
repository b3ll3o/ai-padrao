# ADR-014: Domain audit foundation — typed history, soft-delete, version

- **Status:** Accepted
- **Date:** 2026-08-05
- **Decision type:** Proactive architecture decision
- **Related ADRs:** [ADR-002](./ADR-002-no-import-type-for-nest-di.md), [ADR-007](./ADR-007-no-skipped-tests.md), [ADR-013](./ADR-013-independent-80-percent-coverage.md)

## Context

Today every Prisma model in `apps/api` carries `createdAt`/`updatedAt` and nothing else. Domain entities (currently `User`) cannot be soft-deleted, have no version, and have no audit trail. Three recurring gaps follow:

1. **No recovery from accidental deletes.** A `DELETE /api/users/:id` removes the row. There is no way to bring it back.
2. **No history.** "What did this user's name used to be?" cannot be answered.
3. **No optimistic-concurrency surface.** Concurrent updates race in the database with no detection mechanism.

We want every domain entity (now `User`, future bounded contexts) to ship with: `id`, `createdAt`, `updatedAt`, `deletedAt`, `version`, plus a typed `<entity>_history` table.

`RefreshToken` and other infrastructure tables are explicitly out of scope — they are auth machinery, not domain entities.

## Decision

The audit foundation is delivered through a single, focused change with four parts:

1. **Per-entity typed history table** with `originalId`, `version`, `operation` (`AuditOp` enum), `changedAt`, `changedBy?`, `snapshot Json`. The table is FK-linked back to the entity with `ON DELETE SET NULL` so history survives a hard delete.
2. **Domain entity gains `deletedAt`, `version` readonly fields plus `markDeleted(at)` and `restore()` factory methods.** All instances stay immutable.
3. **Prisma Client extension** at `apps/api/src/infra/prisma/audit/audit-extension.ts` is bound once in `PrismaModule`. It:
   - Injects `where: { deletedAt: null }` into every `user.*` read (unless `__includeDeleted: true`).
   - Replaces `user.delete` with `UPDATE … SET deleted_at = now(), version = version + 1` + a `DELETE` history entry.
   - Wraps `user.update`/`upsert` in `prisma.$transaction` to atomically read the prior row, increment `version`, and write a history entry whose `snapshot` is the prior state.
   - Wraps `user.create` to also write a `CREATE` history entry.
4. **Typed allowlist** `export const AUDITED_MODELS = ['User'] as const`. New bounded contexts add their entity name(s) to this tuple as part of their OpenSpec change.

## Consequences

Positive:

- Recovery from accidental deletes is a one-line HTTP call (`PATCH /api/users/:id/restore`).
- Every state change leaves a typed, queryable trail.
- The domain stays framework-free — the `User` entity doesn't import Prisma or Nest.
- The rule is cheap to apply to new bounded contexts: add the model name to `AUDITED_MODELS` and define a `_history` table.

Negative:

- Write amplification: every update now writes two rows (the entity and one history row).
- A new module under `apps/api/src/infra/prisma/audit/` to maintain.
- ADR-014 + the `AUDITED_MODELS` tuple becomes part of the definition-of-done for new bounded contexts. Drift would re-introduce the same gap.

## Enforcement

1. The new entity fields and history tables are validated by `pnpm db:migrate`.
2. The `AUDITED_MODELS` tuple is reviewed in every OpenSpec change that introduces a new domain entity.
3. Coverage gate (ADR-013) fails CI if the audit code paths push any metric below 80%.
4. No `.skip` tests (ADR-007); the audit extension tests are real integration tests against a Testcontainer Postgres.
5. Nest DI providers in the new files follow ADR-002 (no `import type` for runtime values used in `useFactory` / `useExisting`).

## References

- `.openspec/changes/domain-audit-foundation/` — proposal, tasks, design, spec delta.
- `docs/superpowers/specs/2026-08-05-domain-audit-foundation-design.md` — full design.
- `.harness/INCIDENTS.md` — the audit-foundation work pre-empts the "no undo for delete" class of incidents.