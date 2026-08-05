# Spec: api — ddd-hexagonal-audit-fixes

This spec describes the state of `apps/api/src/contexts/` **after** the
change is implemented.

## Requirements

The keywords **SHALL**, **SHOULD**, and **MAY** follow RFC 2119.

### Compliance with the ddd-hexagonal skill

- THE `users` bounded context SHALL have a `*.spec.ts` file co-located with every `.use-case.ts` file under `application/use-cases/`.
- THE `auth` bounded context SHALL declare every DI token in `auth-context.tokens.ts` as a `Symbol(...)` value — no string or class-concrete tokens.
- THE `auth` bounded context SHALL NOT use `import type` to import any value that appears as a constructor parameter of an `@Injectable()` class.

### Use case semantics (regression)

- WHEN `GetUserHistoryUseCase.execute(id)` is called with a user that exists, THE system SHALL return the full history array (per ADR-014 audit contract) ordered by `version` ascending.
- WHEN `GetUserHistoryUseCase.execute(id)` is called with an id that does not exist, THE system SHALL return `[]` (the in-memory repo never throws; the controller does not pre-check).
- WHEN `RestoreUserUseCase.execute(id, actorId)` is called on a soft-deleted user, THE system SHALL return the user with `deletedAt === null` and `version` incremented.
- WHEN `RestoreUserUseCase.execute(id, actorId)` is called on a user that is already active, THE system SHALL throw `UserNotDeletedError`.
- WHEN `RestoreUserUseCase.execute(id, actorId)` is called on an id that does not exist, THE system SHALL throw `UserNotFoundError`.

### DI wiring

- THE `AuthContextModule` SHALL bind `AUTH_CONTEXT_CONFIG` (now `Symbol("AuthContextConfig")`) via a `useFactory` that reads `JWT_ACCESS_TTL` and `JWT_REFRESH_TTL` from `ConfigService` — same shape as before, only the token identity changes.

## Examples

### Spec file coverage

```
apps/api/src/contexts/users/application/use-cases/
├── find-user.use-case.spec.ts        ✓
├── get-user-history.use-case.spec.ts ✓ (new)
├── list-users.use-case.spec.ts       ✓
├── remove-user.use-case.spec.ts      ✓
├── restore-user.use-case.spec.ts     ✓ (new)
└── update-user.use-case.spec.ts      ✓
```

### DI token after migration

```ts
// apps/api/src/contexts/auth/auth-context.tokens.ts
export const PASSWORD_HASHER_PORT = Symbol("PasswordHasherPort");
export const ACCESS_TOKEN_ISSUER_PORT = Symbol("AccessTokenIssuerPort");
export const REFRESH_TOKEN_GENERATOR_PORT = Symbol("RefreshTokenGeneratorPort");
export const REFRESH_TOKEN_HASHER_PORT = Symbol("RefreshTokenHasherPort");
export const REFRESH_TOKEN_STORE_PORT = Symbol("RefreshTokenStorePort");
export const USER_AUTH_REPOSITORY_PORT = Symbol("UserAuthRepositoryPort");
export const AUTH_CONTEXT_CONFIG = Symbol("AuthContextConfig"); // ← migrated
```
