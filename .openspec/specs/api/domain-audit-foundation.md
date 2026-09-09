# Spec: API — Domain Audit Foundation

This spec describes the behavior of the audit foundation after the change is implemented.

## Requirements

The keywords **SHALL**, **SHOULD**, and **MAY** follow RFC 2119.

### Domain entity shape

- WHEN a domain entity is stored in the database, THE system SHALL persist `id`, `createdAt`, `updatedAt`, `deletedAt` (nullable), and `version`.
- WHEN a domain entity is created, THE system SHALL set `version` to `0`, `deletedAt` to `null`, and write a `CREATE` history entry.
- WHEN a domain entity is updated, THE system SHALL atomically (in a single transaction) increment `version` by `1`, set `updatedAt` to the current time, and write a history entry whose `snapshot` is the prior row state.
- WHEN a domain entity is deleted via the application, THE system SHALL set `deletedAt` to the current time, increment `version` by `1`, and write a `DELETE` history entry. THE system SHALL NOT physically remove the row.
- WHEN a soft-deleted entity is restored, THE system SHALL set `deletedAt` to `null`, increment `version` by `1`, and write a `RESTORE` history entry.

### Read semantics

- WHEN the application reads a domain entity by id, THE system SHALL return `null` (or a 404 over HTTP) when the row is soft-deleted.
- WHEN the application lists domain entities, THE system SHALL exclude soft-deleted rows from the result.
- THE system SHALL expose an explicit `findByIdIncludingDeleted(id)` port method that returns soft-deleted rows for admin/restore paths.

### HTTP API

- WHEN `DELETE /api/users/:id` is called by an authenticated user, THE system SHALL soft-delete the user and return `204`.
- WHEN `PATCH /api/users/:id/restore` is called by an admin, THE system SHALL restore a soft-deleted user and return `200` with the user DTO. THE system SHALL return `404` if no user with that id exists (regardless of deletion state). THE system SHALL return `409` if the user is not currently soft-deleted.
- WHEN `GET /api/users/:id/history` is called by an admin, THE system SHALL return `200` with `{ entries: UserHistoryEntry[] }` ordered by `version` ascending. THE system SHALL return `404` if no user with that id exists.

### Coverage and quality

- THE system SHALL maintain `apps/api` coverage at ≥ 80% on every metric (statements, branches, functions, lines).
- THE system SHALL NOT introduce any skipped or `.todo` tests in tracked files.

## Examples

### Lifecycle

```
POST /api/users (admin) → 201, body { id: "u1", ..., version: 0 }
PATCH /api/users/u1 { name: "Alice2" } → 200, body { id: "u1", ..., version: 1 }
PATCH /api/users/u1 { name: "Alice3" } → 200, body { id: "u1", ..., version: 2 }
DELETE /api/users/u1 → 204
GET /api/users/u1 → 404
GET /api/users/u1/history → 200, body { entries: [
  { version: 0, operation: "CREATE",  changedAt: "...", snapshot: { id: "u1", name: "Alice",  ... } },
  { version: 1, operation: "UPDATE",  changedAt: "...", snapshot: { id: "u1", name: "Alice2", ... } },
  { version: 2, operation: "UPDATE",  changedAt: "...", snapshot: { id: "u1", name: "Alice3", ... } },
  { version: 3, operation: "DELETE",  changedAt: "...", snapshot: { id: "u1", name: "Alice3", deletedAt: "...", ... } },
] }
PATCH /api/users/u1/restore → 200, body { id: "u1", ..., version: 4 }
GET /api/users/u1 → 200, body { id: "u1", ..., version: 4 }
```

### Error

```
PATCH /api/users/u1/restore   (when u1 is not soft-deleted) → 409
{ "statusCode": 409, "message": "User is not deleted", "path": "/api/users/u1/restore" }
```