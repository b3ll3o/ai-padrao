# Design: Domain Audit Foundation

Reference: `proposal.md` in this folder. Full design doc:
`docs/superpowers/specs/2026-08-05-domain-audit-foundation-design.md`.

## Decisions

### Decision 1 — Where the audit/soft-delete logic lives

**Context:** We could push it into the DB via triggers, into the Prisma Client via `$extends`, or push it explicitly into each use case.

**Choice:** A single Prisma Client extension (`apps/api/src/infra/prisma/audit/audit-extension.ts`) plus per-entity typed history tables.

**Rejected alternatives:**

- *Postgres triggers.* Invisible to TypeScript, hard to test deterministically, and impossible to unit-test without a live DB. Also runs outside any transaction the app starts, complicating atomicity.
- *Per-use-case boilerplate.* Every update would need to read the prior row, bump a version, and write history explicitly. High risk of forgetting it on a new use case.
- *Polymorphic audit table.* Cheaper upfront, but breaks DDD (`User` history isn't first-class) and loses the ability to add typed columns later (e.g. `changedBy`).

### Decision 2 — History table shape: per-entity typed with a JSONB snapshot column

**Context:** Each entity needs an audit trail. Options: shared polymorphic table (`entity_audit`), per-entity typed tables (`users_history`, …), or an inline `previous_state` JSONB column.

**Choice:** Per-entity typed tables with one `snapshot Json` column.

**Rejected alternatives:**

- *Polymorphic `entity_audit` table.* Couples unrelated entities and loses FK integrity.
- *Inline `previous_state` column on the entity.* Only captures the immediately-prior state — not a history.

### Decision 3 — Auto-soft-delete vs explicit `softDelete` port method

**Context:** Should reads always skip soft-deleted rows, or should callers opt in?

**Choice:** Reads automatically skip soft-deleted rows (extension injects the filter). `findByIdIncludingDeleted(id)` is the explicit opt-out for admin/restore paths.

**Rejected alternatives:**

- *Manual `includeDeleted: true` on every query.* High risk of forgetting it; easier to leak soft-deleted rows.
- *No filtering — every caller decides.* Same risk; inverted.

### Decision 4 — Snapshotting the prior row inside a `$transaction`

**Context:** We need the prior state to land in history. Reading and writing must be atomic to avoid lost updates.

**Choice:** Wrap `update` in `prisma.$transaction`; inside the tx, `findUnique` then `update` with `version: { increment: 1 }` then `userHistory.create`. Postgres isolation level REPEATABLE READ is the default for Prisma transactions.

**Rejected alternatives:**

- *Triggers.* Rejected above.
- *Outbox + async.* Adds a queue dependency and an at-least-once delivery surface.

### Decision 5 — Allowlist-based model coverage

**Context:** Prisma doesn't support arbitrary metadata tags on models. We need a way to say "audit `User` but not `RefreshToken`".

**Choice:** A typed tuple `AUDITED_MODELS = ['User'] as const` at the top of `audit-extension.ts`. New bounded contexts add their entity name(s) to this tuple as part of their OpenSpec change.

**Rejected alternatives:**

- *Convention like `@audit` comments.* Prisma has no marker syntax; we'd be parsing SQL comments, which is brittle.
- *Apply to every model.* `RefreshToken` would suddenly start writing history, which is the wrong default and increases write amplification on the auth hot path.

## Open questions

None at this time. The deferred items are listed in §11 of the design spec.