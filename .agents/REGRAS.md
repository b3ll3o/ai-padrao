# Regras do Monorepo ai-padrao

> **Arquivo canônico de regras.** Este é o livro de regras do projeto
> `ai-padrao`. Aplica-se a humanos e agentes de IA.
>
> Veja também: [`.agents/AGENTS.md`](AGENTS.md) (orientação rápida) ·
> [`.agents/README.md`](README.md) (layout da árvore de IA) ·
> [`.agents/sdd/AGENTS.md`](sdd/AGENTS.md) (procedimento OpenSpec/SDD)

## Índice

1. [SDD é obrigatório](#1-sdd-e-obrigatorio)
2. [O que NÃO exige SDD](#2-o-que-nao-exige-sdd)
3. [Ações proibidas](#3-acoes-proibidas)
4. [Idioma padrão: pt-br](#4-idioma-padrao-pt-br)
5. [Stack técnico](#5-stack-tecnico)
6. [Arquitetura (DDD + Hexagonal) e cobertura](#6-arquitetura-ddd--hexagonal-e-cobertura)
7. [Sem testes pulados](#7-sem-testes-pulados)
8. [Sem secrets em texto puro](#8-sem-secrets-em-texto-puro)

---

## 1. SDD é obrigatório

**Toda nova funcionalidade (feature) ou mudança de comportamento neste projeto DEVE seguir o fluxo SDD (Specification-Driven Development) via OpenSpec.**

Antes de escrever qualquer código, é necessário:

1. Criar a pasta `.openspec/changes/<feature-name>/` contendo `proposal.md`, `tasks.md`, `design.md` e um delta de spec em `specs/<area>/spec.md`.
2. Aguardar a **aprovação** humana da proposta.
3. Somente então, executar as tarefas em ordem.

Fluxo completo e templates: [`.agents/sdd/AGENTS.md`](sdd/AGENTS.md) (o caminho `.openspec/AGENTS.md` é um symlink para esta pasta, para ferramentas que ainda esperam encontrá-lo lá).

## 2. O que NÃO exige SDD

- Mudanças cosméticas (typos, formatação, refactors sem mudança de comportamento)
- Bumps de versão de dependência sem impacto em API
- Correções de documentação

Mesmo assim, estes commits DEVEM seguir o formato [Conventional Commits](https://www.conventionalcommits.org/).

## 3. Ações proibidas

- ❌ Abrir PR que altera comportamento sem um `.openspec/changes/<feature>/` correspondente.
- ❌ Começar a codificar antes do `proposal.md` ser aprovado.
- ❌ Usar `localStorage` para tokens (auth usa cookies httpOnly).
- ❌ Importar Prisma diretamente em `apps/web` (apenas `apps/api` pode usar Prisma).
- ❌ Modificar `apps/api/prisma/schema.prisma` sem coordenar com os contratos em `packages/contracts`.
- ❌ **Pular, desabilitar ou stubar um teste.** O repositório tem tolerância zero a testes pulados — veja [§7](#7-sem-testes-pulados).

## 4. Idioma padrão: pt-br

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

## 5. Stack técnico

- Monorepo: pnpm 9 + Turborepo 2
- Backend: NestJS 11 (Fastify) + Prisma 6 + Zod (`nestjs-zod`)
- Frontend: Next.js 15 (App Router) + Tailwind 4 + shadcn/ui
- Auth: JWT access (15m) + refresh rotacionado em cookie httpOnly, senhas em Argon2id
- Observabilidade: SDK OpenTelemetry + OTel Collector (OTLP)

## 6. Arquitetura (DDD + Hexagonal) e cobertura

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

## 7. Sem testes pulados

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

## 8. Sem secrets em texto puro

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
