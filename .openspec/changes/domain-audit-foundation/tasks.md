# Tasks: Domain Audit Foundation

Reference: `proposal.md` in this folder. Companion design doc:
`docs/superpowers/specs/2026-08-05-domain-audit-foundation-design.md`.
Companion ADR: `docs/decisions/ADR-014-domain-audit-foundation.md`.

- [ ] 1. Add `deletedAt` and `version` to `User` Prisma model; add `UserHistory` and `AuditOp`
      DoD: `prisma validate` succeeds; new migration `apps/api/prisma/migrations/<ts>_domain_audit/migration.sql` adds the columns, enum, and table.
- [ ] 2. Backfill one `CREATE` history row per existing `User` in the migration
      DoD: migration script reads existing users and inserts history rows; rolls back on any failure.
- [ ] 3. Update `User` domain entity with `deletedAt`, `version`, `markDeleted(at)`, `restore()`
      DoD: `domain/entities/user.spec.ts` extended; tests for `markDeleted`/`restore` pass; factory accepts new primitives.
- [ ] 4. Extend `UserRepositoryPort` with `findByIdIncludingDeleted`, `softDelete`, `restore`, `getHistory`
      DoD: port interface compiles; `InMemoryUserRepository` updated to satisfy the new contract.
- [ ] 5. Implement Prisma Client extension at `apps/api/src/infra/prisma/audit/audit-extension.ts`
      DoD: extension filters reads on `deletedAt`, replaces `delete` with update+history, wraps `update` in a `$transaction`, writes `CREATE` on create; tests cover all four operation types.
- [ ] 6. Wire the extension into `PrismaModule` and update `PrismaService`/`PrismaUserRepository` to use it
      DoD: `PrismaService` exposes the extended client; `PrismaUserRepository` implements the new port methods; existing mapper round-trips `deletedAt`/`version`.
- [ ] 7. Add `RestoreUserUseCase` and `GetUserHistoryUseCase`; rework `RemoveUserUseCase` to call `softDelete`
      DoD: new use cases compile; unit tests cover happy paths and `UserNotFoundError`/`UserNotDeletedError`.
- [ ] 8. Add HTTP routes `PATCH /api/users/:id/restore` and `GET /api/users/:id/history` (admin)
      DoD: controller test covers happy paths and 404/409; e2e spec covers the full lifecycle.
- [ ] 9. Run the full test suite, fix failures, verify coverage ≥ 80% on every metric
      DoD: `pnpm test` green; `pnpm test:coverage` ≥ 80 in every metric; no `.skip` introduced.
- [ ] 10. Commit per Conventional Commits with one commit per task; push the branch; open a PR referencing this change
      DoD: branch `feat/domain-audit-foundation` pushed; PR opened with body linking to the proposal.