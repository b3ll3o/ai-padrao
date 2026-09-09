# Spec: api — ddd-hexagonal-audit-fixes

Esta spec descreve o estado de `apps/api/src/contexts/` **depois** que a
mudança for implementada.

## Requisitos

As palavras-chave **SHALL**, **SHOULD** e **MAY** seguem a RFC 2119.

### Conformidade com a skill ddd-hexagonal

- O contexto delimitado `users` SHALL ter um arquivo `*.spec.ts` co-localizado
  com cada arquivo `.use-case.ts` sob `application/use-cases/`.
- O contexto delimitado `auth` SHALL declarar todo token de DI em
  `auth-context.tokens.ts` como um valor `Symbol(...)` — sem tokens string ou
  classe concreta.
- O contexto delimitado `auth` SHALL NOT usar `import type` para importar
  qualquer valor que apareça como parâmetro de construtor de uma classe
  `@Injectable()`.

### Semântica dos use cases (regressão)

- WHEN `GetUserHistoryUseCase.execute(id)` é chamado com um usuário existente,
  THE system SHALL retornar o array de histórico completo (conforme contrato de
  auditoria do ADR-014) ordenado por `version` ascendente.
- WHEN `GetUserHistoryUseCase.execute(id)` é chamado com um id que não
  existe, THE system SHALL retornar `[]` (o repo in-memory nunca lança; o
  controller não pré-checa).
- WHEN `RestoreUserUseCase.execute(id, actorId)` é chamado em um usuário
  soft-deleted, THE system SHALL retornar o usuário com `deletedAt === null` e
  `version` incrementado.
- WHEN `RestoreUserUseCase.execute(id, actorId)` é chamado em um usuário já
  ativo, THE system SHALL lançar `UserNotDeletedError`.
- WHEN `RestoreUserUseCase.execute(id, actorId)` é chamado em um id que não
  existe, THE system SHALL lançar `UserNotFoundError`.

### Wiring de DI

- O `AuthContextModule` SHALL ligar `AUTH_CONTEXT_CONFIG` (agora
  `Symbol("AuthContextConfig")`) via um `useFactory` que lê `JWT_ACCESS_TTL` e
  `JWT_REFRESH_TTL` do `ConfigService` — mesmo formato de antes, apenas a
  identidade do token muda.

## Exemplos

### Cobertura de spec files

```
apps/api/src/contexts/users/application/use-cases/
├── find-user.use-case.spec.ts        ✓
├── get-user-history.use-case.spec.ts ✓ (novo)
├── list-users.use-case.spec.ts       ✓
├── remove-user.use-case.spec.ts      ✓
├── restore-user.use-case.spec.ts     ✓ (novo)
└── update-user.use-case.spec.ts      ✓
```

### DI token depois da migração

```ts
// apps/api/src/contexts/auth/auth-context.tokens.ts
export const PASSWORD_HASHER_PORT = Symbol("PasswordHasherPort");
export const ACCESS_TOKEN_ISSUER_PORT = Symbol("AccessTokenIssuerPort");
export const REFRESH_TOKEN_GENERATOR_PORT = Symbol("RefreshTokenGeneratorPort");
export const REFRESH_TOKEN_HASHER_PORT = Symbol("RefreshTokenHasherPort");
export const REFRESH_TOKEN_STORE_PORT = Symbol("RefreshTokenStorePort");
export const USER_AUTH_REPOSITORY_PORT = Symbol("UserAuthRepositoryPort");
export const AUTH_CONTEXT_CONFIG = Symbol("AuthContextConfig"); // ← migrado
```
