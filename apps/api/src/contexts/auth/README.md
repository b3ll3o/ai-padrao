# `contexts/auth` — authentication & session bounded context

## Purpose

Issues short-lived JWT access tokens (15m) and rotated refresh tokens
stored in httpOnly cookies. Endpoints:

- `POST /auth/register` — create a user with Argon2id-hashed password.
- `POST /auth/login` — issue access + refresh tokens.
- `POST /auth/refresh` — rotate the refresh token; reject reuse.
- `POST /auth/logout` — invalidate the active refresh token.

Tokens are written and read **only** from httpOnly cookies — never
`localStorage`, never `sessionStorage`. The rule is enforced by
`apps/web/AGENTS.md` and by the integration tests under
`apps/web/src/features/auth/`.

## Structure

```text
contexts/auth/
├── auth-context.module.ts        # composition root
├── auth-context.tokens.ts        # Symbol-based DI tokens for the 5 ports
├── domain/
│   ├── errors/
│   │   ├── email-already-registered.error.ts
│   │   └── invalid-credentials.error.ts
│   └── ports/
│       ├── access-token-issuer.port.ts
│       ├── password-hasher.port.ts
│       ├── refresh-token-generator.port.ts
│       ├── refresh-token-hasher.port.ts
│       ├── refresh-token-store.port.ts
│       └── user-auth.repository.port.ts
├── application/
│   ├── auth-result.ts
│   ├── testing/                  # in-memory fakes for each port
│   └── use-cases/
│       ├── login.use-case.ts
│       ├── logout.use-case.ts
│       ├── refresh.use-case.ts
│       └── register.use-case.ts
└── infrastructure/
    ├── http/
    │   ├── auth-http.controller.ts + .spec.ts
    │   └── dto/auth.dto.ts + .spec.ts
    ├── persistence/prisma/       # adapters for the two persistence ports
    └── security/                 # argon2, jwt, sha256, random — adapters
    └── ttl/parse-ttl.ts          # env string → milliseconds
```

## Layered rule

`auth` consumes `users` through the `UserAuthRepositoryPort` interface
in `users-context.tokens.ts` (the `USER_REPOSITORY_PORT`). It does not
import `users` internals — the dependency arrow points from
`auth → users` via the shared port, never the other way around.

## Why no business abstractions were added

`AuthResult` (in `application/auth-result.ts`) is a plain DTO returned
by every use case — it has no identity or invariants worth promoting to
an entity. Register/login/refresh/logout are CRUD-shaped operations
on the tokens, not behaviour-rich aggregates.