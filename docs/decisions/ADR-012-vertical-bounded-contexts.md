# ADR-012: Contextos delimitados verticais com dependências apontando para dentro

- **Status:** Aceito
- **Date:** 2026-08-04
- **Tipo de decisão:** Decisão proativa de arquitetura
- **ADRs relacionados:** [ADR-013](./ADR-013-independent-80-percent-coverage.md)

## Contexto

O monorepo `ai-padrao` distribui dois apps — `apps/api` (NestJS +
Prisma) e `apps/web` (Next.js) — que compartilham autenticação,
usuários e schemas de contrato. Antes desta decisão, os dois apps
organizavam código por **camada técnica** (`controllers/`, `services/`,
`repositories/`, `dto/`). Esse layout criava três problemas
recorrentes:

1. **Drift cross-cutting.** Uma mudança em "users" tinha que tocar
   quatro subpastas em dois apps. Trabalho de feature se espalhava
   pelo codebase em vez de ficar dentro de uma fatia.
2. **Dependências vazadas.** Lógica de domínio em `services/` podia
   alcançar Prisma, decorators do Nest ou hooks do React
   diretamente. O framework era dono do domínio em vez do contrário.
3. **Fronteiras inconsistentes.** A api e o web cada um inventava
   sua própria convenção para "o que conta como lógica de negócio".
   Refactors em um app não transferiam limpo para o outro.

Precisávamos de um layout que (a) mantivesse capacidades de negócio
juntas, (b) tornasse o framework um detalhe intercambiável, e (c)
fosse aplicável via pipeline de build em vez de depender de disciplina
de review.

## Decisão

Os dois apps — `apps/api` e `apps/web` — organizam capacidades de
negócio como **contextos delimitados verticais**. Cada contexto é uma
pasta autocontida com quatro camadas que apontam para dentro:

- `domain/` — entidades, value objects, erros de domínio, **ports**
  (interfaces). Livre de framework. Depende apenas do runtime da
  linguagem.
- `application/` — casos de uso e fakes em memória para as ports.
  Depende do domínio e dos símbolos de port que orquestra.
- `infrastructure/` (api) / `adapters/` + `infrastructure/` (web) —
  adapters de framework. Conversa com Nest/Prisma/JWT do lado da api
  e com Next.js/fetch/cookies do lado do web. Depende para dentro,
  das ports, e para fora, do framework.
- Composition root — o `*ContextModule` do Nest (api) ou o Next
  middleware + server actions + page segments (web) que ligam cada
  port a um adapter explicitamente.

**Direção de dependência para dentro.** Camadas externas conhecem
camadas internas; camadas internas nunca importam de camadas
externas. Aplicado por regras de ESLint no `eslint.config.mjs` de
cada app e cruzado com grep de fronteira de arquitetura.

**Contextos implementados.**

- API (`apps/api/src/contexts/`):
  - `users/` — entidade `User`, value objects (`Email`, `Name`,
    `UserRole`), `UserRepositoryPort`, casos de uso (`list-users`,
    `find-user`, `update-user`, `remove-user`),
    `PrismaUserRepository` + mapper, `UsersHttpController`,
    `UsersContextModule`.
  - `auth/` — seis ports (`UserAuthRepository`, `PasswordHasher`,
    `AccessTokenIssuer`, `RefreshTokenHasher`, `RefreshTokenStore`,
    `RefreshTokenGenerator`), casos de uso (`register`, `login`,
    `refresh`, `logout`), adapters (`Argon2PasswordHasher`,
    `JwtAccessTokenIssuer`, `Sha256RefreshTokenHasher`,
    `RandomRefreshTokenGenerator`, repositórios Prisma),
    `AuthHttpController`, `AuthContextModule`.
- Web (`apps/web/src/features/`):
  - `auth/` — três ports (`AuthApiPort`, `AuthCookieStorePort`,
    `AuthNavigationPort`), casos de uso (`login`, `register`,
    `logout`, `refresh-session`, `route-access.policy`), adapters
    presentation (`login-form`, `register-form`), adapters
    infrastructure (`fetch-auth-api`, `next-auth-cookie-store`,
    `browser-auth-cookie-store`, `next-auth-navigation`).

**Composition roots** (api: `apps/api/src/app.module.ts` →
`AuthContextModule` + `UsersContextModule`; web:
`apps/web/src/middleware.ts` + `apps/web/src/app/actions/*` +
page segments sob `apps/web/src/app/(auth)/*`) ligam cada port
explicitamente. Rode grep por `bind:` nos arquivos
`*.context.module.ts` para ver a tabela de wiring de cada contexto.

**Fronteira do Prisma.** `apps/api/src/infra/` é dono do
`PrismaClient`. Apenas adapters de infrastructure importam; os
casos de uso veem uma port tipada. `apps/web` NÃO PODE importar
Prisma — aplicado por ESLint e por `AGENTS.md`.

## Consequências

Positivas:

- Novas features aterrissam como uma única pasta de contexto. A
  fatia completa (domain + use cases + adapters + testes) vai
  junta.
- Código de domínio é livre de framework, então pode ser testado
  em unit com zero mocks e sobrevive a trocas de framework.
- A api e o web compartilham vocabulário (`domain/`,
  `application/`, `infrastructure/`, composition root), o que
  torna refactors cross-app mecânicos.
- Regras de arquitetura são checadas por máquina, não por review.

Negativas / trade-offs:

- Um contexto delimitado é uma unidade de mudança mais pesada que
  uma pasta técnica. Features minúsculas de um arquivo agora
  exigem o split de quatro camadas, o que pode soar cerimonial
  para superfícies triviais. Conforme `REGRAS.md`, DDD é aplicado
  de forma pragmática — código puramente apresentacional ou
  declarativo não recebe abstrações de domínio que não precisa.
- O layout vertical duplica o nome do contexto em paths aninhados
  (`contexts/users/infrastructure/http/users-http.controller.ts`).
  Aceitamos a verbosidade porque torna a fatia auto-descritiva.
- Reuso cross-context (ex.: entidade `User` usada tanto em users
  quanto em auth) acontece via `packages/contracts` ou através de
  ports — nunca importando o domínio de um contexto irmão
  diretamente. Isso é aplicado por ESLint.

## Enforcement

- Os configs de ESLint por app (`apps/api/eslint.config.mjs`,
  `apps/web/eslint.config.mjs`) proíbem arquivos de domain/
  application de importar infrastructure, frameworks ou Prisma.
  Um import proibido falha o lint.
- As regras globais de `REGRAS.md` +
  [`apps/api/AGENTS.md`](../apps/api/AGENTS.md) +
  [`apps/web/AGENTS.md`](../apps/web/AGENTS.md) documentam as
  regras de camada por app. Qualquer regra local que enfraqueça
  essas é proibida.
- O gate de cobertura agregado
  ([ADR-013](./ADR-013-independent-80-percent-coverage.md)) pega
  implicitamente layering preguiçoso — se um adapter vaza para
  os casos de uso, a cobertura da camada interna cai e o gate
  falha.
- A checagem de no-skipped-tests (mais o grep automático de
  fronteira de arquitetura) garante que "eu montei a pasta do
  contexto mas não testei" não pode passar verde.
