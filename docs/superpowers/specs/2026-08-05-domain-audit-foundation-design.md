# Domain Audit Foundation — Design

**Date:** 2026-08-05
**Status:** Awaiting human approval
**Branch:** `feat/domain-audit-foundation`
**ADR companion (deliverable):** `docs/decisions/ADR-014-domain-audit-foundation.md`
**OpenSpec change:** `.openspec/changes/domain-audit-foundation/`

## 1. Problem

The API today (`apps/api`) lacks a baseline audit capability for domain entities. The only two Prisma models (`User`, `RefreshToken`) carry `createdAt`/`updatedAt`, but no soft-delete, no version, and no history. There is no way to:

- Recover an accidentally-removed user.
- See what a user's state was three updates ago.
- Detect concurrent updates via optimistic concurrency.

We want every domain entity in the future to inherit: `id`, `createdAt`, `updatedAt`, `deletedAt`, `version`, plus a typed history table. This spec delivers the **foundation** that makes that rule cheap to apply (now for `User`, in the future for every new domain entity).

## 2. Why now

- The repo is small (2 domain entities). The cost of adding the rule now is the lowest it will ever be.
- The `users` bounded context has the most operational value (auditability of admin actions).
- We are about to introduce 1–2 new bounded contexts (the next OpenSpec changes). Laying the foundation first means those new contexts adopt it natively without a retrofit.

## 3. Goals

1. `User` (and every future domain entity) gains: `deletedAt`, `version`, plus a typed `<entity>_history` table.
2. All reads transparently skip soft-deleted rows; all `delete` calls become soft-deletes that emit a `DELETE` history entry.
3. Every update increments `version` atomically and writes the prior state into history.
4. `restore(id)` and `getHistory(id)` use cases exist for `User` and are exposed over HTTP for admins.
5. ADR-014 records the decision so future agents apply the same shape.
6. Coverage of `apps/api` remains ≥ 80% on every metric.

## 4. Non-goals

- Out of scope: applying the rule to `RefreshToken`. It is infrastructure for auth, not a domain entity, and was explicitly excluded by the user.
- Out of scope: full diff-based audit (which fields changed). We snapshot the entire prior row into a JSONB column. Field-level diffs are a future enhancement.
- Out of scope: actor tracking via JWT beyond an optional `actorId` carried through `AsyncLocalStorage`. Full RBAC, audit log streaming to OTel, and immutable audit chain are separate concerns.
- Out of scope: applying this foundation to `apps/web` (no domain entities there).
- Out of scope: optimistic-concurrency surface (`If-Match`/`412`). The `version` column is recorded for future use; the HTTP layer does not yet advertise it.

## 5. Architecture

### 5.1 New components

```text
apps/api/src/infra/prisma/audit/
├── audit-extension.ts            # Prisma $extends: soft-delete + version + history
├── audit-extension.spec.ts
├── audit-context.ts              # AsyncLocalStorage<{ actorId?: string }>
└── audit.types.ts                # AuditOp, HistoryEntry
```

### 5.2 Modified components

- `apps/api/prisma/schema.prisma` — `User` gains `deletedAt`, `version`; new `UserHistory` + `AuditOp` enum.
- `apps/api/src/contexts/users/domain/entities/user.ts` — gains `deletedAt`, `version`, `markDeleted`, `restore` factory methods.
- `apps/api/src/contexts/users/domain/ports/user-repository.port.ts` — gains `findByIdIncludingDeleted`, `restore`, `softDelete`, `getHistory`.
- `apps/api/src/contexts/users/infrastructure/persistence/prisma/prisma-user.repository.ts` — wires the audit extension; implements new port methods.
- `apps/api/src/contexts/users/infrastructure/persistence/prisma/user.mapper.ts` — round-trips `deletedAt`, `version`.
- `apps/api/src/contexts/users/application/use-cases/remove-user.use-case.ts` — calls `repository.softDelete(...)`.
- `apps/api/src/contexts/users/application/use-cases/restore-user.use-case.ts` — **new**.
- `apps/api/src/contexts/users/application/use-cases/get-user-history.use-case.ts` — **new**.
- `apps/api/src/contexts/users/infrastructure/http/users-http.controller.ts` — adds `PATCH /api/users/:id/restore`, `GET /api/users/:id/history` (admin-only).

### 5.3 How the audit extension works

A single Prisma Client extension (`apps/api/src/infra/prisma/audit/audit-extension.ts`) is bound in the composition root (`prisma.module.ts`). It exposes:

| Operation | Current behavior | New behavior |
| --- | --- | --- |
| `user.findFirst` etc. | Reads rows | Adds `where: { deletedAt: null }` unless caller passes `__includeDeleted: true` |
| `user.delete` | `DELETE FROM users` | Replaced with `UPDATE` setting `deleted_at = now()` and `version += 1`; inserts a `DELETE` history entry |
| `user.update` | `UPDATE users SET …` | Wrapped in `$transaction`: reads prior row, runs the update with `version: { increment: 1 }`, writes history |
| `user.upsert` | Create or update | Update path increments version and writes history; create path writes a `CREATE` history entry |
| `user.create` | `INSERT INTO users` | Wrapped to also insert a `CREATE` history entry with the new row's snapshot |

The extension runs on a model-by-model basis. A typed allowlist at the top of `audit-extension.ts` lists the models to audit:

```ts
export const AUDITED_MODELS = ['User'] as const;
export type AuditedModel = (typeof AUDITED_MODELS)[number];
```

Future domain models are added to this tuple (typed) so `RefreshToken` and any other model stay untouched by default. ADR-014 makes adding a model to this tuple part of the definition-of-done for new bounded contexts.

### 5.4 Data flow — restore

```text
PATCH /api/users/:id/restore  ───►  RestoreUserUseCase  ───►  UserRepositoryPort.restore(id, actorId)
                                                        │
                                                        ▼
                                  prisma-user.repository  ───►  prisma.user.update({
                                    where: { id },
                                    data: { deletedAt: null, version: { increment: 1 } },
                                  })  +  prisma.userHistory.create({
                                    ... snapshot of pre-restore row, op: 'RESTORE'
                                  })
```

The domain `User.restore()` produces a candidate entity; the use case calls `repository.restore(id)` which performs the database transition atomically.

## 6. Data model

### 6.1 Prisma additions

```prisma
enum AuditOp {
  CREATE
  UPDATE
  DELETE
  RESTORE
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  name         String
  passwordHash String    @map("password_hash")
  role         UserRole  @default(USER)
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")
  version      Int       @default(0) @map("version")

  refreshTokens RefreshToken[]
  history       UserHistory[]

  @@index([deletedAt])
  @@map("users")
}

model UserHistory {
  id         String   @id @default(cuid())
  originalId String   @map("original_id")
  version    Int      @map("version")
  operation  AuditOp  @map("operation")
  changedAt  DateTime @default(now()) @map("changed_at")
  changedBy  String?  @map("changed_by")
  snapshot   Json     @map("snapshot")

  user User @relation(fields: [originalId], references: [id], onDelete: SetNull)

  @@index([originalId, version])
  @@index([changedAt])
  @@map("users_history")
}
```

`originalId` uses `ON DELETE SET NULL` so the history table survives even if the original user row is later hard-deleted by an admin tool. The snapshot column captures the full row state at the moment of the change.

### 6.2 Migration

`pnpm db:migrate` produces `apps/api/prisma/migrations/<ts>_domain_audit/migration.sql`:

1. `ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ NULL` + index `users_deleted_at_idx`.
2. `ALTER TABLE users ADD COLUMN version INT NOT NULL DEFAULT 0`.
3. `CREATE TYPE audit_op AS ENUM (...)` + `CREATE TABLE users_history (...)`.
4. Backfill: a Node script in the migration folder reads every existing `User` and inserts one `users_history` row with `operation: 'CREATE'`, `version: 0`, `snapshot = JSON row state`, `changedAt = users.created_at`.

### 6.3 Domain entity

```ts
export class User {
  readonly id: UserId;
  readonly email: Email;
  readonly name: Name;
  readonly passwordHash: string;
  readonly role: UserRole;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;   // NEW
  readonly version: number;          // NEW

  markDeleted(at: Date): User { /* immutable copy with deletedAt = at, version+1 */ }
  restore(): User { /* immutable copy with deletedAt = null, version+1 */ }
}
```

## 7. API contract

### 7.1 Repository port

```ts
export interface UserRepositoryPort {
  findById(id: string): Promise<User | null>;
  findByIdIncludingDeleted(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(): Promise<User[]>;
  save(user: User, actorId?: string): Promise<User>;
  softDelete(id: string, actorId?: string): Promise<void>;
  restore(id: string, actorId?: string): Promise<User>;
  getHistory(id: string): Promise<UserHistoryEntry[]>;
}
```

### 7.2 HTTP endpoints (admin role required for new routes)

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/users` | unchanged |
| GET | `/api/users` | unchanged (excludes soft-deleted) |
| GET | `/api/users/:id` | unchanged (404 if soft-deleted) |
| PATCH | `/api/users/:id` | unchanged; bumps `version` |
| DELETE | `/api/users/:id` | now soft-deletes; returns `204` |
| PATCH | `/api/users/:id/restore` | new; admin-only; returns `200` with the restored user |
| GET | `/api/users/:id/history` | new; admin-only; returns `{ entries: UserHistoryEntry[] }` |

### 7.3 Error model

| Case | HTTP | Body |
| --- | --- | --- |
| Soft-deleted user accessed via `findById` | 404 | `{ statusCode: 404, message: 'User not found' }` |
| Restore on a user that is not soft-deleted | 409 | `{ statusCode: 409, message: 'User is not deleted' }` |

## 8. Error handling

- Audit-extension failures bubble up as `Prisma.PrismaClientKnownRequestError`. The use cases translate them into domain errors (`UserNotFoundError`, `UserNotDeletedError`).
- `prisma-user.repository.softDelete` swallows "row not found" and throws `UserNotFoundError` (consistent with `RemoveUserUseCase`).
- The HTTP layer maps `UserNotFoundError` → 404 and `UserNotDeletedError` → 409, via the existing `HttpExceptionFilter`.

## 9. Testing

### 9.1 Unit tests (vitest, in-memory fakes or pure functions)

| File | Covers |
| --- | --- |
| `domain/entities/user.spec.ts` (extended) | `markDeleted`, `restore`, invariants on `deletedAt`/`version` |
| `domain/value-objects/*.spec.ts` | unchanged |
| `application/use-cases/restore-user.use-case.spec.ts` (new) | orchestrates repo + log |
| `application/use-cases/get-user-history.use-case.spec.ts` (new) | returns entries, ordered by `version` asc |

### 9.2 Integration / adapter tests

| File | Covers |
| --- | --- |
| `infra/prisma/audit/audit-extension.spec.ts` (new) | Uses a Testcontainer Postgres; asserts reads skip deleted, delete becomes update with history entry, update writes history, upsert handles both branches |
| `contexts/users/infrastructure/persistence/prisma/prisma-user.repository.spec.ts` (extended) | `softDelete`, `restore`, `getHistory`, `findByIdIncludingDeleted` |
| `contexts/users/infrastructure/persistence/prisma/user.mapper.spec.ts` (extended) | round-trip with `deletedAt`/`version` |

### 9.3 HTTP / e2e tests

| File | Covers |
| --- | --- |
| `contexts/users/infrastructure/http/users-http.controller.spec.ts` (extended) | `DELETE` returns 204 but row remains in DB; `PATCH /:id/restore` returns 200; `GET /:id/history` returns entries |
| `test/users.e2e-spec.ts` (new) | create → update (2×) → soft-delete → history shows 4 entries → restore → history shows 5 entries → GET user returns 200 |

### 9.4 Coverage targets

`apps/api` must hold ≥ 80% on statements, branches, functions, lines. The new audit code paths add ~150 lines, so the additional tests above are calibrated to keep the metrics above the threshold. The CI gate stays as-is.

## 10. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| `$extends` misses a query path (e.g. raw SQL) | Repository port documents `findByIdIncludingDeleted`; raw SQL is forbidden in app code |
| Backfill script fails partway through existing DB | Migration runs in a single transaction; if backfill fails, the migration rolls back and CI never ships it |
| Soft-deleted rows leak into `list()` or list endpoints | Extension filters on `findMany`; unit + e2e tests assert absence |
| Optimistic-concurrency design confuses integrators | The `version` column is documented but not yet surfaced in HTTP; ADR-014 records the deferred optimistic-locking story |
| New code paths reduce coverage below 80% | Coverage gate fails CI; explicit test additions listed in §9 |
| OpenSpec change collides with another in-flight change | Branch is isolated; rebased once before merge |

## 11. Out-of-scope follow-ups

- Apply the same audit pattern to `apps/api/src/contexts/<future>` when new bounded contexts land (enforced via ADR-014 + an architecture test).
- Field-level diffs in `users_history.snapshot` (e.g. separate `changes Json`).
- Audit-log streaming via OpenTelemetry.
- `If-Match` ETag on `PATCH /api/users/:id` (the optimistic-concurrency surface).
- Immutability of `users_history` (DB-level revoke of UPDATE/DELETE on the table for the application role).

## 12. References and deliverables

Deliverables to be produced by this work (all under `feat/domain-audit-foundation`):

- `.openspec/changes/domain-audit-foundation/` — proposal, tasks, design, spec delta (one folder).
- `docs/decisions/ADR-014-domain-audit-foundation.md` — companion decision record.
- `docs/superpowers/specs/2026-08-05-domain-audit-foundation-design.md` — this document.
- `docs/superpowers/plans/2026-08-05-domain-audit-foundation.md` — implementation plan (created via the `writing-plans` skill).

Cross-references:

- `AGENTS.md` — root rulebook (SDD, no-skipped-tests, no-plaintext-secrets).
- `apps/api/AGENTS.md` — DDD/hexagonal architecture & coverage requirements.
- `.harness/INCIDENTS.md` — prior learning (e.g. INC-013: capture deps must be bash+python3 only).