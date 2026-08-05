# `features/auth` — web feature for authentication & session

## Purpose

Mirrors the api `auth` context from the browser side:

- Login & register forms (`adapters/presentation/`).
- Use cases for login / logout / refresh-session / register
  (`application/use-cases/`).
- HTTP & cookie & navigation adapters
  (`infrastructure/adapters/`).
- A `route-access.policy` (`application/`) decides whether the
  current session may enter `(authed)` routes or must be redirected
  back to `(public)/login`.

Tokens live in **httpOnly cookies**, never `localStorage` /
`sessionStorage`. The rule is enforced by tests in
`apps/web/src/features/auth/adapters/presentation/` and by the e2e
flows under `apps/web/src/app/`.

## Structure

```text
features/auth/
├── domain/
│   ├── errors/auth-flow.error.ts
│   └── ports/                    # auth-api, auth-cookie-store, auth-navigation
├── application/
│   ├── route-access.policy.ts
│   ├── testing/                  # fakes for the 3 ports
│   └── use-cases/                # login, logout, refresh-session, register
├── adapters/
│   └── presentation/             # login-form, register-form
└── infrastructure/
    └── adapters/
        ├── auth-cookie.config.ts
        ├── browser-auth-cookie-store.adapter.ts
        ├── fetch-auth-api.adapter.ts
        ├── next-auth-cookie-store.adapter.ts
        └── next-auth-navigation.adapter.ts
```

## Composition root

The App Router pages under `apps/web/src/app/(authed)/` and
`apps/web/src/app/(public)/` are the composition roots. They wire the
infrastructure adapters to the application ports and pass the
resulting use cases into the presentation components.