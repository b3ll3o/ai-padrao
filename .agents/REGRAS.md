# Regras do Monorepo ai-padrao

> **Arquivo canônico de regras.** Este é o livro de regras do projeto
> `ai-padrao`. Aplica-se a humanos e agentes de IA.
>
> Veja também: [`.agents/AGENTS.md`](AGENTS.md) (orientação rápida) ·
> [`.agents/README.md`](README.md) (layout da árvore de IA) ·
> [`.agents/sdd/AGENTS.md`](sdd/AGENTS.md) (procedimento OpenSpec/SDD)

## Índice

1. [SDD é obrigatório](#1-sdd-e-obrigatorio)
2. [SDA — Subagent-Driven Architecture (complemento ao SDD)](#2-sda--subagent-driven-architecture-complemento-ao-sdd)
3. [O que NÃO exige SDD](#3-o-que-nao-exige-sdd)
4. [Ações proibidas](#4-acoes-proibidas)
5. [Idioma padrão: pt-br](#5-idioma-padrao-pt-br)
6. [Stack técnico](#6-stack-tecnico)
7. [Arquitetura (DDD + Hexagonal) e cobertura](#7-arquitetura-ddd--hexagonal-e-cobertura)
8. [Sem testes pulados](#8-sem-testes-pulados)
9. [Pirâmide de testes obrigatória (80% unit + integração + e2e)](#9-piramide-de-testes-obrigatoria)
10. [Sem secrets em texto puro](#10-sem-secrets-em-texto-puro)

---

## 1. SDD é obrigatório

**Toda nova funcionalidade (feature) ou mudança de comportamento neste projeto DEVE seguir o fluxo SDD (Specification-Driven Development) via OpenSpec.**

Antes de escrever qualquer código, é necessário:

1. Criar a pasta `.openspec/changes/<feature-name>/` contendo `proposal.md`, `tasks.md`, `design.md` e um delta de spec em `specs/<area>/spec.md`.
2. Aguardar a **aprovação** humana da proposta.
3. Somente então, executar as tarefas em ordem.

Fluxo completo e templates: [`.agents/sdd/AGENTS.md`](sdd/AGENTS.md) (o caminho `.openspec/AGENTS.md` é um symlink para esta pasta, para ferramentas que ainda esperam encontrá-lo lá).

## 2. SDA — Subagent-Driven Architecture (complemento ao SDD)

SDD define **o quê** entregar (proposal, tasks, design, spec) e em
**que ordem**. SDA define **como** executar as tasks após a aprovação
humana da proposta: despachando um subagente fresco por task, revisando
o resultado entre tasks, e iterando rápido.

SDA **não substitui** o SDD. SDA assume que uma change OpenSpec já
existe, foi aprovada, e está pronta para ser implementada. Em
particular:

- SDA **não** é uma porta de entrada para mudanças sem spec —
  §1 (SDD é obrigatório) ainda prevalece.
- SDA **não** elimina a aprovação humana — uma task só começa depois
  do proposal/tasks.md aprovado.
- SDA **não** delega a responsabilidade de decisões arquiteturais
  para o subagente — ADRs e REGRAS.md seguem sendo a fonte da
  verdade.

### Por que SDA

- **Contexto isolado por task.** Cada subagente começa com o
  contexto completo da task (proposal, ADR relevante, REGRAS.md,
  arquivos-alvo) e termina com um diff delimitado. O contexto da
  task anterior não polui a próxima.
- **Revisão humana entre tasks.** O humano (ou o orquestrador)
  revisa o diff, valida a cobertura e a conformidade com o
  `REGRAS.md`, e só então despacha a próxima task.
- **Paralelismo seguro.** Tasks independentes (ex.: "criar port" +
  "criar mapper") podem rodar em paralelo via worktrees isolados.
  Tasks com dependência (ex.: "criar use case" depende de "criar
  port") seguem sequenciais.
- **Recuperação barata.** Se uma task falha (testes quebram,
  regras violadas), o subagente seguinte não herda a alucinação —
  recebe o diff corrigido como input.

### Quando aplicar SDA

- Implementação de uma change OpenSpec aprovada
  (`.openspec/changes/<feature>/`).
- Execução de um plano `docs/superpowers/plans/<plan>.md`
  task-por-task (cada `- [ ]` vira um despacho).
- Trabalhos de auditoria/cobertura/auditoria de código que seguem
  um checklist em `CHECKLIST.md` (ex.: `ddd-hexagonal/CHECKLIST.md`).

### Quando NÃO aplicar SDA

- Mudanças cosméticas isoladas (typo, formatação) — uma edição
  inline é mais barata que um despacho.
- Trabalho de discovery onde ainda não há tasks — abrir uma change
  SDD primeiro.
- Mudanças onde um humano precisa raciocinar por longos minutos
  antes de escrever código (design de schema novo, debate
  arquitetural) — não force SDA onde o trabalho é genuinamente
  sequencial e conversacional.

### Convenções SDA no ai-padrao

- Cada despacho inclui: (a) o número da task do `tasks.md` ou do
  plan, (b) o caminho exato dos arquivos a ler como contexto, (c)
  a referência ao ADR ou seção de REGRAS.md que governa a
  mudança, (d) a Definition of Done da task.
- Cada commit de task referencia o número no corpo
  (`Refs: tasks.md #3`) para que revisores mapeiem commits →
  checklist.
- Tasks que tocam múltiplos escopos usam commits separados, um por
  escopo (Conventional Commits allowlist em `.commitlintrc.json`).
- Subagentes **não** recebem permissão para commitar ou puchar —
  commit é sempre do orquestrador (humano ou sessão principal)
  após revisar o diff.

### Handoff para SDA

O handoff para um subagente segue o formato abaixo. Subagentes
devem retornar **o diff** (não a história da conversa) para que o
orquestrador possa revisar atomicamente.

```text
Task: <tasks.md #N — título curto>
Context:
  - Proposal: .openspec/changes/<feature>/proposal.md
  - Tasks:    .openspec/changes/<feature>/tasks.md
  - ADR:      docs/decisions/ADR-XXX-<slug>.md (se aplicável)
  - Rules:    .agents/REGRAS.md §<N>
Files to read:
  - <paths exatos>
DoD: <Definition of Done literal do tasks.md>
Forbidden: <lista de ações proibidas específicas desta task>
```

Referência viva: [`docs/superpowers/plans/2026-08-04-ai-padrao-blueprint.md`](../../docs/superpowers/plans/2026-08-04-ai-padrao-blueprint.md) §
"Execution Handoff" define SDA como a opção recomendada de
execução desde o plano original do projeto.

## 3. O que NÃO exige SDD

- Mudanças cosméticas (typos, formatação, refactors sem mudança de comportamento)
- Bumps de versão de dependência sem impacto em API
- Correções de documentação

Mesmo assim, estes commits DEVEM seguir o formato [Conventional Commits](https://www.conventionalcommits.org/).

## 4. Ações proibidas

- ❌ Abrir PR que altera comportamento sem um `.openspec/changes/<feature>/` correspondente.
- ❌ Começar a codificar antes do `proposal.md` ser aprovado.
- ❌ Usar `localStorage` para tokens (auth usa cookies httpOnly).
- ❌ Importar Prisma diretamente em `apps/web` (apenas `apps/api` pode usar Prisma).
- ❌ Modificar `apps/api/prisma/schema.prisma` sem coordenar com os contratos em `packages/contracts`.
- ❌ **Pular, desabilitar ou stubar um teste.** O repositório tem tolerância zero a testes pulados — veja [§8](#8-sem-testes-pulados).

## 5. Idioma padrão: pt-br

O idioma padrão deste projeto é **português brasileiro (pt-br)**. Esta regra vale
para toda documentação, comentários de código e mensagens voltadas para humanos.

### Aplicar pt-br em

- Toda documentação em `.md` (incluindo este arquivo, READMEs, ADRs, templates e changelogs).
- Comentários em código (TS/TSX) — cabeçalhos de arquivo, explicações inline, JSDoc em prosa.
- Mensagens de log, erro e validação — strings literais mostradas a humanos (mensagens de `Logger`, `throw new Error`, mensagens de erro do Zod, mensagens do `Vitest`).
- Descrições de teste em `describe`/`it`/`test` (frases; não os nomes de spec).
- Corpo de mensagem de commit e descrição de PR.
- UI strings do app web quando o target language é pt-br.

### Manter em inglês (exceções técnicas)

- Identificadores de código: classes, interfaces, funções, variáveis, constantes, enums.
  - Princípio: trocar identificador por tradução quebra contratos e refactors silenciosamente.
- Contratos públicos: rotas HTTP, chaves JSON de request/response, schemas Zod, nomes de campo Prisma, payloads de erro.
- Nomes de arquivos, pastas, branches, tags e releases.
- Cabeçalho de commit Conventional Commits (`<type>(<scope>): <subject>`) — segue em inglês conforme a spec do Conventional Commits.
- Comandos de shell, URLs, paths de sistema, comandos de `package.json` (`pnpm up`, etc.).
- Termos técnicos canônicos sem equivalente consensual em pt-br: Aggregate, Repository, Use Case, Bounded Context — manter em inglês (com a tradução entre parênteses na primeira menção do documento).

### Glossário (manter consistência)

| Inglês | pt-br |
| --- | --- |
| feature (DDD bounded context) | contexto delimitado |
| feature (UI capability) | funcionalidade |
| use case | caso de uso |
| entity | entidade |
| aggregate | agregado |
| aggregate root | raiz do agregado |
| value object | objeto de valor |
| repository | repositório |
| domain | domínio |
| application | aplicação |
| infrastructure | infraestrutura |
| adapter | adaptador |
| module | módulo |
| service | serviço |
| controller | controlador |
| request | requisição |
| response | resposta |
| handler | handler |
| bug | bug |
| test | teste |
| coverage | cobertura |
| deployment | deploy / implantação |
| cookie | cookie |
| log | log |
| e2e / end-to-end | e2e |
| middleware | middleware |
| guard | guard |
| interceptor | interceptor |
| pipe | pipe |

Termos que permanecem em inglês em qualquer contexto (siglas técnicas
universais): DTO, JWT, JWE, OIDC, API, REST, CRUD, CI, CD, SDK, SSR, SSG,
BFF, OTLP, DDD, SDD, ATDD, BDD, TDD, SMTP, TLS, CORS, OAuth, Postgres,
Prisma, Fastify, NestJS, Next.js, React, Tailwind, Zod, Vitest, OpenSpec,
ADR, SLA, SLO, SLI, RBAC.

### Como auditar

Em PR de tradução, rodar `grep -RIn "TODO\|FIXME\|i18n miss"` para achar
strings de log e erro que ainda não foram revisadas. Builds de docs
(incluindo este arquivo) devem ficar em pt-br antes do merge.

## 6. Stack técnico

- Monorepo: pnpm 9 + Turborepo 2
- Backend: NestJS 11 (Fastify) + Prisma 6 + Zod (`nestjs-zod`)
- Frontend: Next.js 15 (App Router) + Tailwind 4 + shadcn/ui
- Auth: JWT access (15m) + refresh rotacionado em cookie httpOnly, senhas em Argon2id
- Observabilidade: SDK OpenTelemetry + OTel Collector (OTLP)

## 7. Arquitetura (DDD + Hexagonal) e cobertura

Ambos os apps DEVEM seguir Domain-Driven Design (DDD) e arquitetura
hexagonal. Organize capacidades de negócio como contextos delimitados (bounded
contexts) verticais, mantenha as dependências apontando para o domínio e
isole frameworks e infraestrutura atrás de ports e adapters. Aplique DDD de
forma pragmática: não crie abstrações de domínio para código puramente
apresentacional ou declarativo.

Regras específicas por app:

- [`apps/api/AGENTS.md`](../../apps/api/AGENTS.md) — contextos delimitados da API, fronteiras de domínio e aplicação, adapters NestJS/Prisma, e regras de teste da API.
- [`apps/web/AGENTS.md`](../../apps/web/AGENTS.md) — feature contexts do frontend, adapters de apresentação/infraestrutura, e regras de teste do web.

Cada app DEVE manter, de forma independente, no mínimo **80%** de
statements, branches, functions e lines. CI e o comando de cobertura DEVEM
falhar se qualquer uma dessas métricas em qualquer app estiver abaixo de
80%. Um app ou workspace não pode compensar a falta do outro. Não reduza
thresholds, exclua código de negócio, adicione diretivas de ignore de
cobertura, nem escreva testes sem sentido para satisfazer o gate.

Esses arquivos de regras locais estendem este livro de regras raiz e NÃO
DEVEM enfraquecer as exigências de SDD, segurança ou não-pular-testes.

## 8. Sem testes pulados

**Tolerância zero.** O repositório NÃO PODE conter teste pulado, desabilitado
ou stubado. Concretamente, nenhum dos padrões abaixo é permitido em arquivo
versionado:

| Padrão                                            | Exemplos                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| Jest/Vitest `.skip()`                             | `it.skip(...)`, `test.skip(...)`, `describe.skip(...)`            |
| `xit` / `xdescribe` / `xtest`                     | os aliases com prefixo `x`                                        |
| `test.todo()` / `it.todo()`                       | "Eu prometo escrever depois" — escreva agora ou não escreva       |
| Specs vazios                                      | `*.spec.ts` / `*.test.ts` sem nenhum `it()` / `test()`            |
| Placeholders triviais                             | `it('placeholder', () => { expect(true).toBe(true); })`           |
| Flags que mascaram suites vazias                  | `--passWithNoTests`, `vitest --passWithNoTests`                   |
| E2E pulado porque a infra esta fora               | ex. `it.skipIf(!db)` — suba a infra ou nao shipar o teste          |
| `test.skip` na config do Vitest                   | `test: { skip: true }` em qualquer `vitest.config.*`              |
| `describe` / `it` condicional a env vars          | `if (process.env.X) describe(...)` — arrume o env ou o teste      |

### Por quê

Um teste pulado é uma mentira. Ele diz "está coberto" enquanto não entrega
nenhum sinal. Aprendemos isso na prática durante a estabilização: todo
build verde escondia pelo menos uma suposição que nunca era de fato
exercida — por exemplo, `/api/health` aparecia como "coberto" pelos testes,
mas na verdade respondia 401 porque nenhum teste e2e chamava o endpoint
sem token.

### O que fazer em vez disso

- O comportamento ainda não está pronto → **não escreva o teste agora**.
  Adicione como tarefa no `tasks.md` do
  `.openspec/changes/<feature>/` correspondente e entregue junto.
- O comportamento precisa de uma peça faltando (env, secret, infra) →
  **adicione a peça faltante primeiro** e depois o teste.
- O teste ficaria flaky → **corrija a causa raiz** (isolamento de teste,
  fixtures de factory, rollback de transação). Nunca tape o problema com
  `.skip`.
- O teste depende de um serviço externo nem sempre disponível → **mocke
  deterministicamente** via factory de teste, ou **use Testcontainers**
  para torná-lo disponível.

### Aplicação

Code reviewers e CI DEVEM varrer todo `*.spec.ts`, `*.test.ts`,
`*.spec.tsx`, `*.test.tsx` e `package.json` em busca dos padrões acima e
falhar o build quando qualquer um for encontrado.

## 9. Pirâmide de testes obrigatória (80% unit + integração + e2e)

Esta seção é a versão canônica, curta e operacional, do que
[§7](#7-arquitetura-ddd--hexagonal-e-cobertura) já esboça sobre cobertura.
Os apps DEVEM aplicar a pirâmide de testes completa a **todo fluxo de
negócio** (use case, rota HTTP, feature slice, mutation de UI). Testes
unitários não bastam.

### 9.1 Definição de fluxo

Um **fluxo** é qualquer caminho ponta-a-ponta que altera estado, expõe um
contrato novo ou exerce uma regra de negócio não-trivial. Concretamente:

- API: cada par `(rota HTTP, status esperado)` que implementa um caso de
  uso. Exemplos: `POST /api/auth/register`, `GET /api/users`,
  `POST /api/auth/refresh`.
- Web: cada jornada Server Component ou Client Component que realiza uma
  mutation ou carrega dados não-triviais via `ky`/`fetch`. Exemplos:
  fluxo de login, listagem de usuários, logout.
- Regras de negócio com efeito colateral (jobs, eventos de domínio,
  integrações com filas) também contam como fluxo, mesmo sem rota HTTP.

### 9.2 Os três níveis obrigatórios

| Nível         | O que cobre                                                              | Localização                                       | Regra   |
| ------------- | ------------------------------------------------------------------------ | ------------------------------------------------- | ------- |
| **Unit**      | Domain puro + casos de uso com ports em memória/fakes                    | `*.spec.ts` colado ao código (`src/**/__tests__`)  | §7 + §9.3 |
| **Integração** | Adapters outbound com dependência real (Postgres, Redis, HTTP, filas)   | `*.integration-spec.ts` em `src/**` ou `test/`    | §9.4    |
| **e2e**       | API HTTP completa (Supertest + Nest injector) ou browser real (Playwright) | `*.e2e-spec.ts` em `test/` da app                 | §9.5    |

Mocks manuais (ex.: `jest.fn()`) só são aceitos em testes unitários.
Adapters que tocam banco, fila ou serviço externo DEVEM ser exercidos
contra a dependência real em algum teste de integração — não adianta
mockar Prisma para um repositório e nunca ver a query SQL rodar.

### 9.3 Regra de cobertura unitária (mínimo 80%)

Cada app DEVE manter, de forma independente, **no mínimo 80%** em cada
métrica de cobertura:

- statements: 80%
- branches: 80%
- functions: 80%
- lines: 80%

CI e o comando `pnpm test:coverage` DEVEM falhar se qualquer uma dessas
métricas em qualquer app estiver abaixo de 80%. Um app ou workspace NÃO
compensa shortfall do outro. Não baixe thresholds, não exclua código de
negócio da cobertura, não adicione diretivas `/* istanbul ignore */`
para fazer o gate passar, nem escreva testes sem assertiva.

Exclusões de cobertura se limitam a código gerado, declaration files,
configuração declarativa e composition roots que contenham apenas fiação
de dependência. Lógica de negócio, controllers, casos de uso, adapters,
ramos de erro, modelos de domínio, formulários e componentes
comportamentais NÃO PODEM ser excluídos para bater o threshold. Cada
exclusão precisa ser explícita e justificada ao lado da configuração de
cobertura.

### 9.4 Regra de teste de integração (todo fluxo com efeito colateral)

**Todo fluxo que toca dependência externa real (banco, fila, cache,
serviço HTTP terceiro) DEVE ter pelo menos um teste de integração que
exerça essa dependência real.** Esta regra existe porque mocks manuais
não pegam SQL mal-formado, índices faltando, constraints de schema, drift
de tipo entre Prisma client e banco, problemas de conexão/timeout, ou
concorrência transacional.

- Localização: `*.integration-spec.ts` em `src/**` (colado ao adapter)
  ou `test/integration/` (cross-cutting).
- Como rodar: `pnpm --filter <app> test:integration`.
- Para Postgres: use **Testcontainers** (`testcontainers` package)
  orquestrado em `globalSetup`, ou um Postgres descartável criado pelo
  `docker-compose.test.yml`. A `DATABASE_URL` de teste aponta para esse
  banco descartável — nunca para o banco de dev.
- Migrations são aplicadas no setup (`prisma migrate deploy` ou
  `prisma db push`) antes dos testes rodarem.
- Cada teste é responsável por seu próprio rollback (transação
  envolvendo o teste, ou truncamento de tabelas entre testes). Não
  confie em ordem de execução.
- Adapters HTTP externos: use `msw` (Mock Service Worker) em modo
  servidor para exercitar o cliente contra handlers HTTP realistas;
  `nock` é aceito como alternativa.
- Filas/Redis: use `Testcontainers Redis` ou um `ioredis-mock` apenas
  se o adapter já estiver coberto por um teste de integração contra
  Redis real em outro nível.

### 9.5 Regra de teste e2e (todo fluxo HTTP/UI)

**Todo fluxo que expõe um contrato HTTP (api) ou uma jornada do usuário
(web) DEVE ter pelo menos um teste e2e.** O objetivo do e2e é provar que
o sistema inteiro se comporta como esperado ponta-a-ponta: bootstrap do
Nest, pipes/guards globais, exception filter, persistência, contratos.

- API: `*.e2e-spec.ts` em `apps/api/test/`, executado via
  `pnpm --filter @ai-padrao/api test:e2e` (Jest + Supertest contra o
  injector do Fastify). Config em `apps/api/test/jest-e2e.json`.
- Web: `*.e2e-spec.tsx` em `apps/web/e2e/` ou `apps/web/test/e2e/`,
  executado via `pnpm --filter @ai-padrao/web test:e2e` (Playwright ou
  similar). O caminho do navegador DEVE incluir o fluxo de login
  sempre que a página testada exigir sessão.
- O setup do e2e (variáveis de ambiente, migrations) vive em
  `apps/<app>/test/setup.ts` e `apps/<app>/test/jest-e2e.json`.
- Cada e2e cobre **um fluxo crítico**: pelo menos um caso feliz + um
  caso de erro esperado (validação, auth, conflito). Cenários
  puramente unitários NÃO devem virar e2e — use o nível certo.
- Não stub nada em e2e. Banco, fila e serviços externos rodam de
  verdade (descartáveis via Testcontainers/docker-compose.test).
- Não invente dados mágicos — use factories com timestamps únicos
  (ex.: `\`test-\${Date.now()}-\${rand}@example.com\``) para evitar
  colisão entre execuções.

### 9.6 Comandos canônicos por app

| Comando                            | Roda                                                          |
| ---------------------------------- | ------------------------------------------------------------- |
| `pnpm test`                        | suite unit (Jest para api, Vitest para web)                   |
| `pnpm test:integration`            | suite integration (Testcontainers Postgres/Redis, msw)        |
| `pnpm test:e2e`                    | suite e2e (Supertest na api, Playwright no web)               |
| `pnpm test:coverage`               | unit + mede cobertura com gate ≥80%                           |
| `pnpm test:all`                    | unit + integration + e2e em sequência (CI usa este)           |

`pnpm test:all` é o que CI invoca por padrão. PRs DEVEM manter este
comando verde local antes de pedir review.

### 9.7 Aplicação

Code reviewers e CI DEVEM:

1. Falhar o PR se um novo fluxo não trouxer testes nos três níveis
   quando aplicável (use case novo ⇒ unit; adapter novo ⇒ integration;
   rota nova ⇒ e2e).
2. Falhar o PR se algum teste estiver pulado — [§8](#8-sem-testes-pulados)
   prevalece.
3. Falhar o PR se a cobertura cair abaixo de 80% em qualquer métrica.

A regra de ouro: **se um teste passa com tudo mockado, ainda falta o
teste de integração. Se um teste mocka banco/fila/HTTP em e2e, está
errado.**

## 10. Sem secrets em texto puro

`~/.claude/settings.json` desta máquina carrega um `ANTHROPIC_AUTH_TOKEN`
(`sk-cp-…`) e um `GITHUB_PERSONAL_ACCESS_TOKEN` (`github_pat_…`) em texto
puro. Qualquer agente que copie inputs de ferramenta para um log
persistente, mensagem de commit ou doc corre o risco de gravar esses
tokens em disco. Defesa em duas camadas:

1. **Redação manual (cinto de segurança).** Agentes DEVEM redatar tokens
   de qualquer saída de ferramenta capturada antes de persisti-la. Nunca
   cole inputs brutos de ferramenta em commit, doc ou diretório de log no
   estilo `.harness/`. O hook automático L1 de captura foi removido; a
   redação agora é responsabilidade do agente.
2. **Varredura de formato de secret no pre-push (airbag).** O script
   `.githooks/pre-push` faz grep em todo `*.ts`/`*.tsx`/`*.js`/`*.jsx`
   sob `apps/` e `packages/` em busca de formatos conhecidos de token
   (`sk-ant-`, `sk-cp-`, `ghp_`, `github_pat_`, `AKIA…`) e falha o push
   quando encontra algum.
