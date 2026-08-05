# `contexts/users` — user CRUD + audit bounded context

## Purpose

The canonical user aggregate. Exposes:

- `GET /users` — list with paging (`page`, `pageSize`).
- `GET /users/:id` — fetch one (skips soft-deleted).
- `PATCH /users/:id` — partial update (admin or self).
- `DELETE /users/:id` — soft delete (admin).
- `PATCH /users/:id/restore` — admin-only restore.
- `GET /users/:id/history` — admin-only audit trail.

Audit semantics follow **ADR-014**:

- `findById`, `findByEmail`, `list`, `update` skip soft-deleted rows.
- `softDelete` flips `deletedAt` and writes a `UserHistoryEntry`.
- `restore` clears `deletedAt` and writes a `UserHistoryEntry`.
- `findByIdIncludingDeleted` bypasses the soft-delete filter.
- `getHistory` returns entries ordered by `version` ascending.

## Structure

```text
contexts/users/
├── users-context.module.ts       # composition root
├── users-context.tokens.ts       # USER_REPOSITORY_PORT (Symbol)
├── domain/
│   ├── entities/user.ts          # aggregate with soft-delete awareness
│   ├── value-objects/            # email, name, user-role
│   ├── errors/                   # user-not-found, user-not-deleted
│   └── ports/user-repository.port.ts
├── application/
│   ├── testing/in-memory-user.repository.ts
│   └── use-cases/                # find / get-history / list / remove / restore / update
└── infrastructure/
    ├── http/
    │   ├── users-http.controller.ts + .spec.ts
    │   └── dto/users.dto.ts + .spec.ts
    └── persistence/prisma/
        ├── prisma-user.repository.ts + .spec.ts
        └── user.mapper.ts + .spec.ts
```

## Reference implementation

This context is the **canonical reference** for the DDD-hexagonal
shape in this repo. The skill `.claude/skills/ddd-hexagonal/SKILL.md`
points here for "what a complete bounded context looks like" when
adding a new one.

## Why the `USER_REPOSITORY_PORT` is exported

`auth` depends on this port (not on `users` internals) to look up
users during register / login / refresh. The arrow is
`auth → users (port)`, never `users → auth`. See
`apps/api/AGENTS.md` §"Dependency rules" for the full inbound rule.