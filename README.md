# ai-padrao

Blueprint de monorepo: **Next.js 15 + NestJS 11 + PostgreSQL 16**, totalmente dockerizado, orientado por SDD.

## Quickstart (5 minutos)

Requer Docker, Docker Compose e Node 22+.

```bash
git clone <repo-url> my-project
cd my-project
corepack enable
pnpm install
pnpm postmerge:install   # opt-in: habilita .githooks/post-merge
cp .env.example .env
pnpm up
pnpm db:migrate
pnpm db:seed
```

`pnpm postmerge:install` é um comando único que define `git config
core.hooksPath .githooks` para o clone local. A cada `git pull` (ou
merge), o hook roda os passos de validação implícitos nos arquivos
alterados — por exemplo, `pnpm install` quando `pnpm-lock.yaml` mudou.
Veja [`.githooks/README.md`](.githooks/README.md) para o desenho
completo. Desative com `git config --local --unset core.hooksPath`.

Abra:

| Serviço     | URL                          |
| ----------- | ---------------------------- |
| App web     | <http://localhost:3000>      |
| API         | <http://localhost:3001>      |
| Swagger UI  | <http://localhost:3001/docs> |
| MailHog UI  | <http://localhost:18025>     |

Usuário seed padrão: `admin@ai-padrao.local` / `admin123`.

## Stack

| Camada          | Escolha                                                                      |
| --------------- | ---------------------------------------------------------------------------- |
| Monorepo        | pnpm 9 + Turborepo 2 workspaces                                              |
| Backend         | NestJS 11 sobre Fastify + Prisma 6 + Zod (`nestjs-zod`)                      |
| Frontend        | Next.js 15 (App Router) + Tailwind 4 + shadcn/ui                             |
| Auth            | JWT (15m access) + refresh rotacionado em cookie httpOnly + Argon2id          |
| Banco           | PostgreSQL 16                                                                |
| Observabilidade | SDK OpenTelemetry + OTel Collector                                           |
| E-mail (dev)    | MailHog (portas do host `11025` / `18025` para evitar colisão entre projetos) |
| Container       | `docker-compose.yml` com 5 serviços (postgres, api, web, mailhog, otel-collector) |
| Editor          | Visual Studio Code (configuração do workspace em `.vscode/`)                 |

## Arquitetura

Veja [`docs/superpowers/specs/`](docs/superpowers/specs/) para o
desenho completo.

| App / Pacote              | Propósito                          |
| ------------------------- | ---------------------------------- |
| `apps/api`                | API REST NestJS 11 + Fastify       |
| `apps/web`                | Frontend Next.js 15 (App Router)   |
| `packages/db`             | Re-export do cliente Prisma        |
| `packages/contracts`      | Schemas Zod compartilhados front + back |
| `packages/ui`             | Componentes shadcn/ui              |
| `packages/config-eslint`  | Configs ESLint 9 (flat) compartilhados |

## Spec-Driven Development (obrigatório)

Toda nova feature DEVE seguir o fluxo **SDD (Specification-Driven
Development)** via OpenSpec. Antes de escrever código, crie
`.openspec/changes/<feature-name>/` com `proposal.md`, `tasks.md`,
`design.md` e um delta de spec em `specs/<area>/spec.md`. Aguarde a
aprovação humana e só então implemente.

Fluxo completo + templates: [`AGENTS.md`](AGENTS.md) e
[`.openspec/AGENTS.md`](.openspec/AGENTS.md).

## Políticas do projeto (tolerância zero)

O repositório aplica várias políticas de "tolerância zero". Elas estão
documentadas em [AGENTS.md](AGENTS.md) e são aplicadas por code review
+ CI:

- ❌ **Sem testes pulados** — `it.skip`, `xit`, `xdescribe`, `xtest`,
  `it.todo`, `--passWithNoTests` e `describe`/`it` condicionais são
  proibidos. Teste é real ou não existe.
- ❌ Sem `console.*` em `apps/api/src/main.ts` — use o `Logger` do Nest.
- ❌ Sem API estilo Express (`res.setHeader`, `res.cookie`) sob Fastify.
- ❌ Sem portas "well-known" padrão (1025, 8025, 3000, 5432, etc.) em
  `docker-compose.yml` — colidem com projetos vizinhos.
- ❌ `import type` em arquivos com DI do NestJS (controllers, services,
  guards, strategies, interceptors, decorators).

Toda mudança que tocar essas áreas DEVE ser revisada contra o ADR
correspondente antes do merge.

## Scripts

| Comando           | O que faz                                |
| ----------------- | ---------------------------------------- |
| `pnpm up`         | Sobe todos os serviços Docker            |
| `pnpm down`       | Para todos os serviços                   |
| `pnpm logs`       | Tail dos logs de todos os serviços       |
| `pnpm db:migrate` | Aplica migrations Prisma (no container da api) |
| `pnpm db:seed`    | Roda o script de seed                    |
| `pnpm db:reset`   | Reseta o banco + roda migrations + seed  |
| `pnpm build`      | Build de todos os pacotes                |
| `pnpm dev`        | Roda todos os servidores de dev          |
| `pnpm test`       | Roda testes unit + e2e nos pacotes       |
| `pnpm lint`       | Lint em todos os pacotes                 |
| `pnpm typecheck`  | Checagem de TypeScript nos pacotes       |
| `pnpm clean`      | Apaga dist, `.next`, `.turbo`, `node_modules` |

## Convenções

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/)
  com `commitlint`. Escopos permitidos (conforme
  [`.commitlintrc.json`](.commitlintrc.json)): `root`, `api`, `web`,
  `contracts`, `db`, `ui`, `config`, `docker`, `sdd`, `deps`.
  Validação de formato roda no hook `commit-msg`.
- **Branches:** Trunk-based; branch padrão é `main`.
- **Editor:** VSCode. Configurações do workspace em
  [`.vscode/settings.json`](.vscode/settings.json) (format-on-save,
  ESLint flat config, awareness do monorepo); extensões recomendadas
  em [`.vscode/extensions.json`](.vscode/extensions.json).
- **Regras para IA:** A fonte da verdade única é
  [`AGENTS.md`](AGENTS.md) (e o livro completo em
  [`.agents/REGRAS.md`](.agents/REGRAS.md)). Claude Code, Gemini CLI,
  Codex e qualquer outra assistente de IA leem os mesmos arquivos.

## Para saber mais

- [`AGENTS.md`](AGENTS.md) — fluxo SDD, ações proibidas e config do editor.
- [`.agents/REGRAS.md`](.agents/REGRAS.md) — livro de regras completo do
  monorepo (idioma pt-br, sem testes pulados, sem secrets).
- [`docs/decisions/README.md`](docs/decisions/README.md) — índice de ADRs.
- [`docs/superpowers/specs/2026-08-04-ai-padrao-blueprint-design.md`](docs/superpowers/specs/2026-08-04-ai-padrao-blueprint-design.md) —
  a spec de design que originou o projeto.
- [`docs/superpowers/plans/2026-08-04-ai-padrao-blueprint.md`](docs/superpowers/plans/2026-08-04-ai-padrao-blueprint.md) —
  o plano de implementação.
