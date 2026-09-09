# CLAUDE.md

> **Local canônico:** `.agents/CLAUDE.md`. O projeto segue um único
> padrão `.agents/`; não há `CLAUDE.md` ou `.claude/` na raiz do
> repositório — veja [`.agents/README.md`](README.md) para o layout
> e as regras de descoberta por ferramenta.

Orientação para o Claude Code (claude.ai/code) ao trabalhar neste
repositório. O livro de regras global para IA vive em
[`AGENTS.md`](AGENTS.md); este arquivo cobre apenas orientação
específica do Claude Code.

## Configurando o Claude Code para encontrar skills em `.agents/skills/`

O Claude Code varre `~/.claude/skills/` (usuário) e `.claude/skills/`
(projeto) por padrão. Este projeto mantém skills em
[`.agents/skills/`](skills/). Para fazer o Claude Code encontrá-las
neste repo, adicione `.agents/skills` em `skillsPaths` no seu
`~/.claude/settings.json` (nível de máquina), ou exporte a variável
de ambiente `CLAUDE_CODE_SKILLS_PATH=.agents/skills` antes de
iniciar o Claude Code. Veja [`.agents/README.md`](README.md) para a
racional completa da descoberta.

## 1. Identidade do projeto

Este repo é **`ai-padrao`**, um blueprint de monorepo para apps
full-stack guiadas por SDD: Next.js 15 (web) e NestJS 11 / Fastify
(api) e Prisma 6 e Postgres, tudo conectado via pnpm 9 workspaces e
Turborepo 2. É um **blueprint** — convenções e ADRs são entregáveis
de primeira classe, não apenas código incidental. O leitor é
encorajado a copiar a forma e adaptar o conteúdo.

Editor de referência: **Visual Studio Code** (configurações em
`.vscode/`).

## 2. Comandos comuns

Todos os comandos rodam da raiz do repo salvo indicação. Definidos em
[`package.json`](package.json).

```bash
pnpm up               # docker compose up -d (postgres + api + web)
pnpm up:tools         # idem + mailhog + otel-collector (--profile dev-tools)
pnpm down             # docker compose down
pnpm logs             # docker compose logs -f
pnpm db:migrate       # prisma migrate dev (dentro do container da api)
pnpm db:seed          # prisma seed (usuário admin)
pnpm db:reset         # prisma migrate reset --force
pnpm dev              # turbo run dev (api + web com hot-reload)
pnpm build            # turbo run build
pnpm lint             # turbo run lint
pnpm typecheck        # turbo run typecheck
pnpm test             # turbo run test (vitest, unit + e2e)
```

Para rodar um único teste (de qualquer pacote):
`pnpm test path/to/spec.ts`.

## 3. Arquitetura de alto nível

```text
.
├── apps/
│   ├── api/          NestJS 11 + adapter Fastify. Modules sob src/modules/.
│   │                 Cliente Prisma 6 vive aqui. Único app que pode importar Prisma.
│   └── web/          Next.js 15 App Router. UI em packages/ui, tipos em packages/contracts.
├── packages/
│   ├── contracts/    Schemas Zod compartilhados entre api e web. Fonte da verdade para
│   │                 shapes de request/response. Toque ANTES de schema.prisma.
│   ├── db/           Wrapper do cliente Prisma, migrations, helpers de seed.
│   ├── ui/           Componentes shadcn/ui + primitivos Tailwind 4.
│   └── config-{tsconfig,eslint,prettier}/  Configs de toolchain compartilhadas.
├── docs/
│   ├── decisions/    ADRs (ADR-001..). Cada um curto e no formato Nygard.
│   └── superpowers/  Artefatos opcionais de planejamento (brainstorming → planos → review).
├── .openspec/        Fluxo SDD (proposal → approval → build → archive).
├── .githooks/        Gates locais de pre-push + post-merge.
├── infra/            Dockerfiles, compose, config do OTel Collector.
└── docker-compose.yml  Postgres + MailHog + OTel Collector para dev local.
```

**Fluxo de requisição (web → api):** Server Component / Route Handler
do Next.js importa um cliente tipado de `packages/contracts` (que
re-exporta os schemas Zod). O cliente chama a api via HTTP com um
JWT a partir do cookie httpOnly. A api valida com o mesmo schema Zod
via `nestjs-zod`, bate no Prisma e retorna a resposta tipada.

**Limites de módulo (api):** cada feature vive em
`src/modules/<feature>/` com `controller.ts`, `service.ts`,
`*.module.ts` e `dto/` para tipos Zod de input. Imports cross-module
acontecem via o service exportado do módulo, nunca via banco
diretamente.

## 4. Convenções únicas do ai-padrao

Coisas que você não consegue inferir lendo um único arquivo:

- **Conventional Commits são obrigatórios.** Escopos vêm do allowlist
  em [`.commitlintrc.json`](.commitlintrc.json): `root`, `api`,
  `web`, `contracts`, `db`, `ui`, `config`, `docker`, `sdd`, `deps`.
- **PRs que mudam comportamento DEVEM referenciar uma change
  OpenSpec** em `.openspec/changes/<feature>/`. `AGENTS.md` lista as
  únicas exceções (cosmético, bump de dep, fix de doc). Por padrão,
  abra uma change.
- **Decisões de arquitetura viram ADR.** Quando você introduz uma
  decisão NOVA que não cabe em nenhum ADR, escreva um novo — veja a
  seção "When to add a new ADR" em `docs/decisions/README.md`.
- **Sem testes pulados, em lugar nenhum.** Tolerância zero — veja
  AGENTS.md §"Sem testes pulados" para a regra completa.
- **Tokens de auth vivem em cookies httpOnly, nunca em
  localStorage.** Veja AGENTS.md para a lista completa de ações
  proibidas.

## 5. Registros de decisão

Abra [`docs/decisions/README.md`](docs/decisions/README.md) primeiro
— o índice lista todos os ADRs em uma tabela. Os três de maior
tráfego (leia-os mesmo que não leia mais nada):

1. **ADR-007** — Sem testes pulados. Disparado em cada teste que
   você escreve.
2. **ADR-002** — Não use `import type` para DI do Nest. Disparado
   em cada refactor de import sob `apps/api/`.
3. **ADR-006** — Use `Logger` do Nest, não `console.*`. Disparado em
   cada edit em `apps/api/src/main.ts`.

Quando você mudar comportamento, encontre o ADR correspondente e
atualize-o.

## 6. Editor / configuração de IA

- **`.vscode/settings.json`** — Prettier como formatador padrão para
  TS/TSX/JSON/Markdown; ESLint flat config com save-fix explícito;
  TypeScript do workspace travado no TS do repo; regex de classes do
  Tailwind inclui padrões `cN()` e `cn()` de `packages/ui`.
  Format-on-save está **on** para todas as linguagens listadas.
- **`.vscode/extensions.json`** — Recomendadas: ESLint, Prettier,
  Tailwind IntelliSense, Prisma, Docker, GitLens, Vitest Explorer,
  Copilot + Copilot Chat, Ruby LSP (Shopify). As instruções de
  commit do Copilot Chat já vêm pré-carregadas com as regras de
  Conventional Commits + escopo — você não precisa re-promptá-las.
- **`.editorconfig`** — LF, newline final, sem trailing whitespace.
  Casa com defaults do Prettier.
- **`AGENTS.md`** — O livro de regras canônico para TODAS as
  assistentes de IA (Claude Code, Gemini CLI, Codex). Leia. É mais
  estrito que este arquivo em SDD e secrets.
- **`.github/copilot-instructions.md`** — Não presente; AGENTS.md é a
  fonte cross-tool.

## 7. Expectativas de fluxo para Claude Code

Quando você receber um pedido de mudança de comportamento:

1. **Leia AGENTS.md primeiro.** Se não leu, não tem contexto para
   agir. A regra de SDD vale até para mudanças "pequenas".
2. **Abra uma change OpenSpec** em
   `.openspec/changes/<feature>/` com os quatro arquivos exigidos
   (`proposal.md`, `tasks.md`, `design.md`, `specs/<area>/spec.md`).
   Veja `.agents/sdd/AGENTS.md` §2 para o template e o §5 para
   arquivar a change depois do merge.
3. **Pare e aguarde a aprovação humana** na proposta. Não comece o
   `tasks.md` antes da aprovação chegar.
4. **Execute o `tasks.md` em ordem, um commit por tarefa** usando o
   escopo de Conventional Commits que casa com a área do arquivo.
   Referencie o número da tarefa no corpo do commit.
5. **Após o merge, arquive** conforme `.agents/sdd/AGENTS.md` §5:
   mova o delta de spec para `.openspec/specs/<area>/<feature>.md`,
   acrescente ao `.openspec/CHANGELOG.md`, apague a pasta da change.

Quando o usuário pedir trabalho só de documentação
(`.agents/CLAUDE.md`, `README.md`, ADRs, `CONTRIBUTING.md`,
`ARCHITECTURE.md`), siga o §10 de `AGENTS.md`: SDD não é exigido,
mas Conventional Commits valem. Use o escopo `sdd` para ADRs e
`root` para o resto.

Em caso de dúvida sobre uma ação ser proibida, consulte
AGENTS.md §"Ações proibidas" antes de agir.
