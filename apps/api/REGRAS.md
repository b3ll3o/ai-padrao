# Regras do App API (`apps/api`)

> **Regras do monorepo:** [`../../.agents/REGRAS.md`](../../.agents/REGRAS.md)
> são a fonte da verdade. Este arquivo **estende** (nunca enfraquece) as
> regras raiz e foca no app api.

> **Orientação rápida:** [`./AGENTS.md`](./AGENTS.md) é o índice de
> orientação. Leia primeiro o AGENTS.md, depois este REGRAS.md.

## Índice

1. [Arquitetura obrigatória](#1-arquitetura-obrigatoria)
2. [Regras de dependência](#2-regras-de-dependencia)
3. [Pastas e convenções de nomenclatura](#3-pastas-e-convencoes-de-nomenclatura)
4. [Boas práticas NestJS](#4-boas-praticas-nestjs)
5. [Boas práticas Prisma](#5-boas-praticas-prisma)
6. [Validação com Zod + nestjs-zod](#6-validacao-com-zod--nestjs-zod)
7. [Logs e erros](#7-logs-e-erros)
8. [Auth e segurança](#8-auth-e-seguranca)
9. [Observabilidade](#9-observabilidade)
10. [Pirâmide de testes obrigatória (unit + integração + e2e)](#10-piramide-de-testes-obrigatoria)
11. [Cobertura mínima](#11-cobertura-minima)
12. [Checklist de PR para a API](#12-checklist-de-pr-para-a-api)
13. [Fluxo de mudança](#13-fluxo-de-mudanca)

---

## 1. Arquitetura obrigatória

A API DEVE seguir Domain-Driven Design (DDD) e arquitetura hexagonal.
Novas capacidades de negócio DEVEM ser implementadas como contextos
delimitados (bounded contexts) verticais. Contextos existentes migram
de forma incremental; uma migração deve manter contratos externos
estáveis a menos que um delta OpenSpec aprovado os altere explicitamente.

Um contexto DEVE usar esta forma:

```text
<context>/
├── domain/                  # entidades, value objects, agregados, ports
├── application/             # casos de uso, DTOs de aplicação, orquestração
├── adapters/
│   └── inbound/             # controllers, DTOs HTTP, presenters
├── infrastructure/
│   └── adapters/            # Prisma repositories, clients, gateways
└── <context>.module.ts      # composition root (bind port → implementação)
```

Use DDD de forma pragmática. Crie entidades, value objects, agregados,
domain services e domain events somente quando representarem
comportamento real ou invariantes. Não adicione abstrações que apenas
renomeiam operações de framework ou banco de dados.

## 2. Regras de dependência

Dependências DEVEM apontar para dentro:

```text
adapters inbound -> application -> domain
adapters outbound -> application/domain ports (via ports)
composition root -> todas as camadas
```

- `domain/` NÃO PODE importar NestJS, Fastify, Prisma, clientes de banco,
  bibliotecas HTTP ou código de infraestrutura.
- `application/` DEVE depender apenas de tipos do `domain/` e das
  `ports` declaradas, nunca de adapters concretos.
- Controllers e DTOs HTTP são adapters inbound. Eles validam e
  traduzem dados HTTP, mas NÃO PODEM conter regras de negócio.
- Repositórios Prisma, serviços de JWT, hashers de senha, relógios
  (Clock), geradores de ID, filas e clients externos são adapters
  outbound atrás de ports.
- Registros Prisma são modelos de persistência, não entidades de
  domínio. Faça o mapeamento no boundary de infraestrutura.
- Nest modules são composition roots. Eles ligam ports a
  implementações e NÃO PODEM conter regras de negócio.
- Um contexto delimitado NÃO PODE acessar tabelas ou adapters internos
  de outro contexto. Chamadas cross-context usam um contrato de
  aplicação explicitamente exportado.
- Código em locais compartilhados (`shared/`, `common/`) DEVE ser neutro
  de domínio. Não use `shared` como atalho para furar limites de
  contexto.

## 3. Pastas e convenções de nomenclatura

- **Arquivos:** `kebab-case` (`login.use-case.ts`).
- **Classes:** `PascalCase`.
- **Métodos/variáveis:** `camelCase`.
- **Constants globais:** `SCREAMING_SNAKE_CASE`.
- **DTOs HTTP:** `<Acao><Recurso>Dto` (`LoginRequestDto`,
  `CreateUserResponseDto`).
- **Domain events:** verbo no passado (`UserCreated`,
  `SessionRevoked`, `PasswordChanged`).
- **Ports:** `<Recurso>Port` ou `<Recurso><Papel>` (ex.:
  `UserRepository`, `Hasher`, `Clock`, `IdGenerator`,
  `EventPublisher`).
- **Adapters outbound:** sufixo indica a tecnologia (`UserPrismaRepository`,
  `Argon2Hasher`, `NodeCryptoIdGenerator`, `NestEventPublisher`).
- **Adapters inbound:** sufixo `<Recurso>Controller`, `<Recurso>Presenter`.
- **Pastas `domain`:** `entities/`, `value-objects/`, `events/`,
  `errors/`, `ports/`.
- **Pastas `application`:** `use-cases/`, `services/` (orquestração),
  `dtos/`.

## 4. Boas práticas NestJS

- Use decorators de NestJS para DI em classes runtime. **Não** use
  `import type` em DI tokens (veja ADR-002): NestJS depende de
  metadados em tempo de execução via decorators, não consegue resolver
  providers corretamente sem o tempo de execução do símbolo.
- Providers têm, em geral, **uma classe por arquivo** quando o
  adapter é significativo (repositórios, casos de uso). Providers
  triviais podem coexistir em `*.providers.ts`.
- Use os helpers do `nestjs-zod` (`@ZodBody`, `@ZodQuery`, `@ZodParam`)
  em vez de pipes manuais — gera `openapi.json` consistente e
  mensagens de erro padronizadas.
- Prefira os guards/ pipes/ interceptors/ filters nativos do Nest.
  Customizações ficam em adapters, não no core.
- Módulos de feature são composition roots. Não exponha implementação
  concreta para outros módulos; exporte apenas o que está documentado
  no contrato.
- Providers com ciclo de vida (conexão, cache, etc.) implementam
  `OnModuleInit`/`OnModuleDestroy` no adapter, não no caso de uso.
- Não injete Prisma `Client` diretamente em casos de uso; sempre
  através do port do repositório.

## 5. Boas práticas Prisma

- **Migrações:** crie via `pnpm db:migrate` (dentro do container da
  api). Não edite o arquivo de migração após ele ser mergeado em
  `main` — crie uma nova migração corretiva.
- **Source of truth:** `apps/api/prisma/schema.prisma` modela o
  domínio de persistência. **Não** adicione campo em `schema.prisma`
  sem antes atualizar o schema Zod correspondente em
  `packages/contracts`.
- **Mapeamento:** records Prisma viram entidades de domínio (ou DTOs
  de aplicação) no boundary do adapter. Não exponha `Prisma.*` types
  para domínio ou aplicação.
- **Consultas:** declare `select`/`include` no adapter; nunca use
  `findMany()` sem seleção explícita em produção.
- **Transações:** use `prisma.$transaction([...])` ou
  `prisma.$transaction(async tx => ...)` com escopo bem definido;
  nunca em `domain` ou `application`.
- **Soft deletes:** somente quando explicitamente aprovado em ADR;
  preferir `deletedAt: DateTime?` + índice composto.
- **Seed:** vive em `packages/db` (ou `apps/api/prisma/seed.ts`) e é
  idempotente — `upsert` em vez de `create`.
- **Cliente:** expor via `packages/db`; nada importa `@prisma/client`
  fora da api.

## 6. Validação com Zod + nestjs-zod

- Schemas Zod vivem em `packages/contracts`. A API importa de lá.
- Use `@ZodBody`, `@ZodQuery`, `@ZodParam` (`nestjs-zod`) — a doc
  OpenAPI sai grátis e as mensagens seguem o formato padrão.
- Mensagens de erro customizadas em Zod ficam em pt-br (idioma padrão
  do projeto), mas o **shape** do erro (`code`, `details`,
  `requestId`) é fixo.
- Domínio NÃO importa Zod. Validação fica em adapters inbound; em
  `application`/`domain`, valide tipos via invariantes do construtor
  da entidade.

## 7. Logs e erros

- Use **`Logger` do NestJS** (`@nestjs/common`), nunca `console.*`
  (veja ADR-006). Crie `new Logger(NomeDoContexto)` por arquivo
  significativo.
- Níveis: `verbose` / `debug` para detalhes de fluxo; `log` para
  ciclo de vida; `warn` para erros recuperáveis; `error` para
  falhas com impacto ao usuário.
- **Nunca** logue tokens, senhas, Authorization headers, PII
  ou secrets. Use redação no adapter se o dado sensível for
  inevitável.
- `requestId` (ou `traceId`) vem do contexto OTel — propague via
  `Logger` ou injetando `REQUEST` quando relevante.
- Erros de domínio são exceções tipadas (`DomainError`,
  `InvalidCredentialsError`, etc.). Adapters inbound traduzem para
  exceções HTTP via `HttpExceptionFilter` central.

## 8. Auth e segurança

- JWT access curto (15m) + refresh rotacionado em cookie httpOnly;
  nunca armazene tokens em `localStorage` ou `sessionStorage`.
- Senhas com Argon2id; nunca outro algoritmo.
- Guards aplicados no controller (`@UseGuards(AuthGuard,
  RolesGuard)`); roles/permissões via metadata + helper
  `@Roles('admin')` + `RolesGuard` configurado no composition root.
- Renovação e revogação de sessão passam sempre pela `application`.
- Cookies: `httpOnly`, `secure`, `sameSite=lax` em produção; em dev,
  ajuste `sameSite` se a UI local precisar.
- CSRF: como a app web usa cookies + `sameSite=lax`, mantenha
  verificação de origem para rotas sensíveis; documente a estratégia
  em ADR quando introduzir.
- **Não** exponha stack traces ou detalhes internos de erro em
  respostas HTTP em produção; mapeie para
  `{ code, message, requestId }`.
- Headers de segurança (`helmet` se aplicável) ficam no adapter
  inbound, configurados uma vez no composition root.

## 9. Observabilidade

- SDK OpenTelemetry no `main.ts` (já configurado no scaffold).
- Spans automáticos para HTTP (Fastify), Prisma, Nest.
- Spans manuais (`@trace` ou `tracer.startActiveSpan`) em casos de
  uso com ramificação de domínio (workflows longos).
- Atributos de span: `feature`, `use_case`, `actor.id` (hash),
  `entity.id` (quando útil). Nunca `Authorization`, nunca PII.
- Métricas: contadores de uso de cada caso de uso, histograma de
  duração de endpoints, gauge de profundidade de fila quando houver.
- Logs e traces compartilham `traceId` — correlacione via
  `traceparent` quando relevante.

## 10. Pirâmide de testes obrigatória (unit + integração + e2e)

A regra canônica vive em
[`../../.agents/REGRAS.md` §9](../../.agents/REGRAS.md#9-piramide-de-testes-obrigatoria).
Este §10 aplica aquela regra ao app `api` em três níveis:

### 10.1 Unit (Jest + ports em memória)

- Localização: `*.spec.ts` colado ao arquivo de produção em `src/**`.
- Domínio: 100% puro. Sem NestJS, sem Prisma, sem HTTP. Cobre
  entidades, value objects, invariantes, agregados, domain services,
  factories e domain events.
- Aplicação: casos de uso com **fake ports** ou ports em memória
  determinísticos; sem NestJS e sem banco real.
- Regras de dependência (forbidden imports) são checadas em lint
  (`apps/api/eslint.config.mjs`) e/ou em testes de arquitetura.
- Regressão: cada bugfix vem com um teste que falha antes do fix e
  passa depois.
- Comando: `pnpm --filter @ai-padrao/api test`.

### 10.2 Integração (Testcontainers Postgres + Prisma real)

- Localização: `*.integration-spec.ts` em `src/contexts/<context>/infrastructure/`
  ou `test/integration/`.
- Adapters outbound que tocam Postgres DEVEM ser exercidos contra um
  Postgres descartável levantado via **Testcontainers** no `globalSetup`
  de `apps/api/test/jest-integration.json`. A `DATABASE_URL` de teste é
  apontada para esse container; o banco de dev **nunca** é usado.
- Migrations são aplicadas no setup com `prisma migrate deploy` antes
  dos testes rodarem (script `test:integration:setup` em
  `apps/api/package.json`).
- Cada teste é responsável pelo próprio rollback (transação envolvendo
  o teste, ou truncamento de tabelas entre testes). Não confie em
  ordem de execução.
- Adapters HTTP externos: use `msw` (Mock Service Worker) em modo
  servidor para exercitar o cliente contra handlers HTTP realistas;
  `nock` é aceito como alternativa.
- Comando: `pnpm --filter @ai-padrao/api test:integration`.

Exemplo de arquivo aceito:
`apps/api/src/contexts/users/infrastructure/persistence/prisma/prisma-user.repository.integration-spec.ts`.

### 10.3 e2e (Supertest + Nest injector)

- Localização: `*.e2e-spec.ts` em `apps/api/test/`.
- Configuração: `apps/api/test/jest-e2e.json` (Jest apontando para o
  padrão `*.e2e-spec.ts`, com `--runInBand` e setup em
  `apps/api/test/setup.ts`).
- O setup força `NODE_ENV=test`, secrets de JWT dummy e
  `DATABASE_URL` apontando para o Postgres descartável
  (Testcontainers) — não usar dev DB.
- Cada e2e cobre um fluxo crítico inteiro: bootstrap do Nest,
  pipes/guards globais, exception filter, persistência, contrato
  público. Pelo menos um caso feliz + um caso de erro esperado
  (validação, auth, conflito).
- Não stub nada. Banco, fila e serviços externos rodam de verdade.
- Use factories com timestamps únicos
  (`` `test-${Date.now()}-${rand}@example.com` ``) para evitar
  colisão entre execuções.
- Comando: `pnpm --filter @ai-padrao/api test:e2e`.

### 10.4 Comandos canônicos

| Comando                            | O que roda                                                 |
| ---------------------------------- | ---------------------------------------------------------- |
| `pnpm --filter @ai-padrao/api test`            | suite unit (Jest)                       |
| `pnpm --filter @ai-padrao/api test:integration` | suite integration (Testcontainers)      |
| `pnpm --filter @ai-padrao/api test:e2e`        | suite e2e (Supertest + Nest injector)   |
| `pnpm --filter @ai-padrao/api test:coverage`   | unit + cobertura com gate ≥80%          |
| `pnpm --filter @ai-padrao/api test:all`        | unit + integration + e2e em sequência   |

A regra raiz de **tolerância zero a testes pulados** vale integralmente.

## 11. Cobertura mínima

`apps/api` DEVE manter, de forma independente, no mínimo **80%** em
cada métrica de cobertura:

- statements: 80%
- branches: 80%
- functions: 80%
- lines: 80%

CI e o comando `pnpm --filter @ai-padrao/api test:coverage` DEVEM
falhar se qualquer métrica estiver abaixo do limite. Cobertura de
outro workspace ou app **não** compensa shortfall da api.

Exclusões de cobertura se limitam a código gerado, declaration files,
configuração declarativa e composition roots que contenham apenas fiação
de dependência. Lógica de negócio, controllers, casos de uso, adapters,
ramos de erro e modelos de domínio NÃO PODEM ser excluídos para bater
o threshold. Cada exclusão precisa ser explícita e justificada ao lado
da configuração de cobertura.

Não baixe thresholds, não adicione diretivas de ignore, não escreva
testes sem assertiva para fazer a cobertura passar. Adicione testes
com significado.

## 12. Checklist de PR para a API

Antes de pedir review, confirme:

- [ ] `pnpm --filter @ai-padrao/api typecheck` e `lint` limpos.
- [ ] `pnpm --filter @ai-padrao/api test` verde.
- [ ] Coverage ≥80% em todas as métricas (CI valida).
- [ ] Endpoints novos ou alterados têm teste e2e.
- [ ] Schemas Zod atualizados em `packages/contracts` **antes** de
      qualquer mudança em `schema.prisma`.
- [ ] Migração Prisma criada e revisada.
- [ ] Logs não carregam tokens, segredos ou PII.
- [ ] Guards de auth/roles aplicados onde necessário.
- [ ] OpenAPI regenerado e commitado quando relevante.
- [ ] Sem `console.*` (Nest Logger no lugar).
- [ ] Sem `import type` em providers NestJS (ADR-002).
- [ ] Sem `.skip`/`.todo`/`xit`/`xdescribe` (regra raiz).
- [ ] Mensagens de log/erro em pt-br (regra raiz de idioma).

## 13. Fluxo de mudança

Migrações DDD/hexagonais e mudanças em enforcement de cobertura
afetam comportamento ou política de build. Exigem um change
OpenSpec aprovado em `.openspec/changes/<feature>/` antes da
implementação, conforme as regras raiz.
