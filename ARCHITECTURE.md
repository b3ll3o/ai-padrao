# Arquitetura

Visão macro do `ai-padrao`. Para o dia-a-dia "como eu…", veja
[`CONTRIBUTING.md`](CONTRIBUTING.md); para as regras que assistentes
de IA devem seguir veja [`AGENTS.md`](AGENTS.md). Para o _porquê_ de
decisões específicas veja [`docs/decisions/`](docs/decisions/).

## 1. Diagrama do sistema

```text
┌─────────────────────────────────────────────────────────────────┐
│                          docker-compose                         │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐               │
│  │ postgres │◄───┤   api    │    │     web      │               │
│  │  :5432   │    │ (NestJS) │    │  (Next.js)   │               │
│  └──────────┘    │ :3001    │    │   :3000      │               │
│       ▲          └────┬─────┘    └──────┬───────┘               │
│       │               │                │                        │
│       │          ┌────▼─────┐    ┌─────▼──────┐                │
│       │          │ mailhog  │    │   otel-    │                │
│       │          │ :11025   │    │  collector │                │
│       │          │ :18025   │    │   :4317    │                │
│       │          └──────────┘    └─────┬──────┘                │
│       │                                │                       │
│       │         (mailhog recebe        │ export OTLP           │
│       │         e-mails só de dev)     ▼                       │
│       │                          ┌──────────┐                  │
│       └──────────────────────────┤   OTel   │                  │
│                                  │ backend  │ (qualquer vendor)│
│                                  └──────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

O dev local roda `docker compose up -d` para `postgres + api + web`.
Para incluir os containers de tooling (`mailhog` e `otel-collector`),
use `docker compose --profile dev-tools up -d` (atalho `pnpm up:tools`).
Em produção os mesmos serviços de tooling ficam sob o mesmo profile
(`infra/compose/docker-compose.vps.yml`), e api/web apontam para
equivalentes gerenciados quando aplicável.

## 2. Forma do monorepo

```text
apps/
  api/            NestJS 11 + Fastify adapter. Único app que usa Prisma.
  web/            Next.js 15 App Router. Importa tipos de packages/contracts.
packages/
  contracts/      Schemas Zod. Fonte da verdade dos shapes de request/response.
                  Toque ANTES de schema.prisma.
  db/             Wrapper do cliente Prisma, migrations, helpers de seed.
  ui/             Componentes shadcn/ui + primitivos Tailwind 4.
  config-*/       Configs compartilhadas de TS / ESLint / Prettier.
docs/
  decisions/      ADRs (formato Nygard). Cada um é uma decisão real.
  superpowers/    Artefatos de brainstorming e planejamento.
.openspec/        Fluxo SDD (proposal → aprovação → build → archive).
infra/            Dockerfiles, config do OTel Collector.
```

`apps/web` e `apps/api` são irmãos. NÃO PODEM importar um ao outro; a
superfície compartilhada é `packages/contracts` (Zod) e HTTP. Isso
mantém a história de deploy simétrica — qualquer app pode ser trocado
sem tocar o outro.

## 3. Fluxo de requisição (web → api)

```text
Browser
  │  cookie httpOnly: ai-padrao-refresh=<opaco>
  │
  ▼
Next.js (apps/web)
  │  Server Component / Route Handler
  │  importa cliente tipado de packages/contracts
  │  Authorization: Bearer <JWT access, apenas em memória>
  ▼
NestJS (apps/api) — adapter Fastify
  │  Helmet → CORS → RateLimit → JwtAuthGuard (global via APP_GUARD)
  │  ValidationPipe (Zod via nestjs-zod, schema de packages/contracts)
  │  Controller → Service → Prisma
  ▼
PostgreSQL 16
  │  cliente Prisma 6 (apenas apps/api)
  ▼
Resposta (tipada por Zod, mesmo schema nos dois lados)
```

Endpoints públicos (`/api/health`, `/api/auth/*`) carregam o
decorator `@Public()` para sair do guard JWT global. Veja
[ADR-003](docs/decisions/ADR-003-public-decorator-on-health-auth.md).

## 4. Fluxo de auth

```text
login / register
   │
   ▼  (verifica Argon2id)
emite JWT access (15 min) ────── devolvido no corpo da resposta
emite refresh token (opaco) ── setado como cookie httpOnly, rotacionado a cada uso
   │
   ▼
requisições seguintes
   │
   ├── Authorization: Bearer <JWT access>             ← curta duração
   │
   ├── ao receber 401, POST /api/auth/refresh         ← usa cookie httpOnly
   │     ├── rotaciona refresh (uso único, registrado no DB)
   │     ├── emite novo JWT access
   │     └── seta novo cookie httpOnly
   │
   └── logout: POST /api/auth/logout                  ← limpa cookie + revoga no DB
```

Tokens NUNCA moram em `localStorage`. O refresh token é opaco e
rastreado no DB; a rotação invalida o token anterior imediatamente.
Veja o módulo auth da api para a implementação canônica e
[`AGENTS.md`](AGENTS.md) para a regra.

## 5. Mapa de módulos — apps/api

```text
src/
  main.ts                     bootstrap (Nest Logger apenas, veja ADR-006)
  app.module.ts               composition root
  common/
    decorators/               @Public(), @CurrentUser(), @Roles()
    filters/                  mapeamento exception → resposta HTTP
    interceptors/             logging (Pino), request-id
    guards/                   JwtAuthGuard (global), RolesGuard (opt-in)
  modules/
    auth/                     login, register, refresh, logout
    health/                   GET /api/health (@Public, sem deps)
    users/                    CRUD + roles
    audit/                    audit log append-only
    notifications/            envio de e-mail (usa mailhog em dev)
prisma/
  schema.prisma               fonte da verdade, owned aqui
  migrations/                 geradas, commitadas
  seed.ts                     usuário admin
```

Cada módulo exporta UM service. Imports cross-module acontecem via o
service, nunca via banco. Novos módulos entram em
`src/modules/<feature>/` com o esqueleto de quatro arquivos
(`*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`).

## 6. Modelo de dados (Postgres via Prisma)

Tabelas núcleo (veja `apps/api/prisma/schema.prisma` para a fonte
da verdade):

- `User` — id, email (único), passwordHash (Argon2id), role,
  createdAt.
- `RefreshToken` — id, userId, tokenHash, expiresAt, revokedAt.
  Append-only; rotação revoga a linha antiga.
- `AuditLog` — id, userId, action, targetType, targetId, payload
  (JSONB), createdAt. Sem update ou delete — append-only.

O schema é owned por `apps/api`. `packages/contracts` re-exporta
os shapes Zod que envolvem os mesmos campos. Quando o schema muda,
os contracts mudam PRIMEIRO, depois `schema.prisma` — veja a regra
de coordenação em [`AGENTS.md`](AGENTS.md).

## 7. Observabilidade

O SDK do OpenTelemetry é inicializado em `apps/api/src/main.ts` e em
`apps/web/instrumentation.ts`. Cada requisição HTTP carrega um id
de correlação (interceptor request-id); cada chamada Prisma é
traced; cada linha de log carrega os mesmos ids de trace + span.

Em dev, os traces exportam para o container `otel-collector` via
OTLP (gRPC :4317). O collector faz fan-out para o backend que o
time usa (Jaeger, Tempo, Honeycomb). A taxa de sampling é
configurada por ambiente via `OTEL_TRACES_SAMPLER_ARG`.

Pino é o transporte de log. `console.*` é proibido em
`apps/api/src/main.ts` (ADR-006). Todo outro módulo usa o
`Logger` do Nest.

## 8. Por que esta forma

A arquitetura codifica 11 decisões, cada uma ligada a um defeito
real:

- [ADR-001](docs/decisions/ADR-001-fastify-reply-api.md) — API
  de reply do Fastify (interoper Nest + Fastify quebrava em
  runtime).
- [ADR-002](docs/decisions/ADR-002-no-import-type-for-nest-di.md)
  — Sem `import type` para DI do Nest (`emitDecoratorMetadata`).
- [ADR-003](docs/decisions/ADR-003-public-decorator-on-health-auth.md)
  — Decorator `@Public()` em endpoints de infra.
- [ADR-004](docs/decisions/ADR-004-dockerfile-copy-schema-before-generate.md)
  — Ordem de copy no Dockerfile para Prisma.
- [ADR-005](docs/decisions/ADR-005-non-default-ports.md) —
  Host ports fora do padrão no compose.
- [ADR-006](docs/decisions/ADR-006-nest-logger-not-console.md) —
  `Logger` do Nest, não `console.*`.
- [ADR-007](docs/decisions/ADR-007-no-skipped-tests.md) —
  Tolerância zero a testes pulados.
- [ADR-011](docs/decisions/ADR-011-no-plaintext-secrets-in-source.md)
  — Sem tokens em texto puro no source versionado.

Leia o índice em [`docs/decisions/README.md`](docs/decisions/README.md)
antes de abrir uma mudança em qualquer uma dessas áreas.

## 9. Onde estender

- **Novo endpoint da API:** abra `.openspec/changes/<feature>/`,
  adicione o schema Zod em `packages/contracts`, depois o
  controller em `apps/api/src/modules/<feature>/`.
- **Nova página de UI:** adicione componentes em `packages/ui`
  primeiro, depois a rota em
  `apps/web/app/<rota>/page.tsx`.
- **Nova coluna no banco:** atualize o Zod em `packages/contracts`,
  depois `apps/api/prisma/schema.prisma`, depois rode
  `pnpm db:migrate`.
- **Novo ADR:** escreva `docs/decisions/ADR-NNN-<slug>.md` e
  adicione ao índice.
