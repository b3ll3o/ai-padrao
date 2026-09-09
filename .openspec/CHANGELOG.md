# Changelog do OpenSpec

Arquivos de mudanças aprovadas, em ordem cronológica reversa. Cada entrada
registra a data em que a mudança foi arquivada, o nome da feature, o resumo
arquitetural, os commits merged que a entregaram e o autor do arquivamento.

## 2026-09-09 — `harness-removal`

- **Feature:** `harness-removal`
- **Autor:** Claude Code (pass de limpeza)
- **Delta de spec:** nenhum — trata-se de uma remoção, não de mudança de
  comportamento.

### Resumo

Removido o `.harness/` (loop auto-aprimorador de agentes) do projeto. O
harness adicionava complexidade significativa (pipelines de
capture/detect/digest, codemods, rastreamento de INC-XXX, gate de
complexidade, workflow pós-merge) e já não vale o custo operacional em
um projeto blueprint.

### O que mudou

- Apagado `.harness/` (scripts de capture/detect/digest, `pattern_match.py`,
  `redact.py`, `INCIDENTS.md`, `learnings.json`, `codemods/`, `graph/`,
  `loop/`).
- Apagado `.openspec/specs/harness/` (`complexity-gate`,
  `post-merge-pull-workflow`, `inc-017`, `inc-024`).
- Apagados ADRs que existiam só por causa do harness: ADR-008 (scripts
  de capture), ADR-009 (events gitignored), ADR-010 (digest diário),
  ADR-018 (skill de cobertura de documentação).
- Removidos os scripts `harness:*` e o hook `prebuild` de `package.json`.
- Simplificado `.githooks/pre-push` para `lint + typecheck + test`
  (removidos `docker compose up`, espera do Postgres, e2e).
- Simplificado `.githooks/post-merge` para `pnpm install` quando
  `pnpm-lock.yaml` muda (removidos `harness:check`, `db:migrate`, testes
  de runtime).
- Atualizados `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `README.md`,
  `CONTRIBUTING.md`, `ARCHITECTURE.md`, `.openspec/AGENTS.md`,
  `.githooks/README.md`, `docs/decisions/README.md`,
  `.claude/skills/ddd-hexagonal/SKILL.md`,
  `.claude/skills/ddd-hexagonal/CHECKLIST.md`.

### O que foi preservado

As políticas que o harness aplicava (sem testes pulados, sem `console.*`
em `main.ts`, sem API estilo Express sob Fastify, sem host ports padrão
well-known, sem `import type` para DI do Nest) continuam obrigatórias.
Elas vivem em `docs/decisions/ADR-*.md` e em `AGENTS.md`. Revisores e
CI as aplicam manualmente.

## 2026-08-04 — `ddd-hexagonal-coverage`

- **Feature:** `ddd-hexagonal-coverage`
- **Autor:** Claude (subagent)
- **Spec arquivada:**
  `.openspec/specs/architecture/ddd-hexagonal-coverage.md`

### Resumo

Adotadas arquitetura DDD e hexagonal em `apps/api` e `apps/web`, com
gate de cobertura de 80% independente por app e por métrica
(statements, branches, functions e lines). Verificado que o código de
domínio permanece livre de framework, que o código de aplicação
depende de capacidades outbound via ports, e que todos os contratos
públicos (rotas, status codes, schemas Zod, nomes de cookie, claims
de JWT, rotação de token, rotas web) foram preservados.

A migração foi entregue incrementalmente em 15 tarefas mais uma onda
de correções de follow-up:

1. `2e5b46a` — `docs(sdd): propose DDD hexagonal migration and coverage gate`
2. `798ee43` — `chore(deps): add per-app coverage baseline tooling`
3. `c14e636` — `test(root): characterize auth and users before architecture migration`
4. `98b0fc5` — `chore(config): enforce hexagonal dependency direction`
5. `b2909ee` — `feat(api): add users domain model and repository port`
6. `21d8930` — `feat(api): add users application use cases`
7. `fe77708` — `feat(api): add prisma users adapter and mapper`
8. `06e4706` — `feat(api): swap users http adapter to contexts/users`
9. `8f45115` — `feat(api): add auth domain ports and use cases`
10. `4c8215b` — `feat(api): add auth infrastructure adapters`
11. `c7433f2` — `feat(api): swap auth http adapter to contexts/auth`
12. `1876a61` — `refactor(web): migrate auth to ports and adapters`
13. `2258234` — `test(root): enforce 80 percent coverage per app and metric`
14. `7985524` — `fix(api): cast through unknown in logging interceptor spec`
15. `1b7ed77` — `docs(sdd): document hexagonal contexts and coverage enforcement`

As 15 tarefas do plano estão completas. As sub-tarefas 2 e 3
(baselines de cobertura e testes de caracterização) foram
intencionalmente deixadas desmarcadas no proposal original porque
foram sobrescritas pelos commits dedicados acima e não são
necessárias para a capability arquivada. O commit final de
arquivamento (Task 15.5) encerra a pasta de change.

## Changelog do OpenSpec

Specs arquivadas em `.openspec/specs/<area>/<feature>.md` são a fonte
da verdade. Entradas aqui registram quando cada spec mudou de
`changes/` para `specs/`.

## 2026-08-04

- **inc-017-detector-excludes-docs** — `.harness/pattern_match.py`
  (detector L2) agora exclui eventos de Write em caminho de
  documentação do cálculo do eixo de arquivos, enquanto os
  preserva no blob combinado do eixo de símbolos. Evita
  falso-positivos INC-002/INC-003 quando agentes editam
  `docs/decisions/`, `.harness/INCIDENTS.md`, ou
  `.harness/learnings.json`. Spec arquivada em
  `.openspec/specs/harness/inc-017-detector-excludes-docs.md`. Tasks
  de implementação 1–6 (INCIDENTS.md, learnings.json,
  pattern_match.py, test_pattern_match.py, wire-up de check.sh,
  run full green) completas; PASS=15, SKIP=3.

## 2026-08-05

- **domain-audit-foundation** — Toda entidade de domínio (atualmente
  `User`, futuros bounded contexts) é entregue com `id`, `createdAt`,
  `updatedAt`, `deletedAt`, `version`, mais uma tabela `<entity>_history`
  tipada. A extensão de auditoria vive em
  `apps/api/src/infra/prisma/audit/` e é ligada uma vez no
  `PrismaModule` via uma extensão do Prisma Client. Novas rotas:
  `PATCH /api/users/:id/restore` e `GET /api/users/:id/history`.
  Spec arquivada em `.openspec/specs/api/domain-audit-foundation.md`.
  Linkada ao [ADR-014](../docs/decisions/ADR-014-domain-audit-foundation.md).

- **inc-024-detector-type-vs-di** — Fecha o gap INC-024 + INC-025
  das heurísticas de `import type` do detector L2. (1) INC-025: globs
  do eixo de arquivos agora batem com o caminho de arquivo apenas
  via o novo helper `_file_path_for_axis(event)`, não com o conteúdo
  de Write/Edit (estrutural). (2) INC-024: classificador AST-lite
  (`classify_import_type_binding`) marca bindings com sufixo
  (Type, Interface, Dto, Context, Spec, Map, Key, Schema) como
  `type-only-safe` e suprime INC-003. Bindings de risco de
  class-DI (ex.: `FindUserUseCase`, `User`, `PrismaService`)
  ainda disparam. Spec arquivada em
  `.openspec/specs/harness/inc-024-detector-type-vs-di.md`.
  Linkada a INC-024 + INC-025 em `.harness/INCIDENTS.md`.

- **post-merge-pull-workflow** — Hook opt-in `.githooks/post-merge`
  roda os passos de validação implícitos nos arquivos alterados em
  um merge (incluindo `git pull`): `pnpm-lock.yaml` →
  `pnpm install --frozen-lockfile`; `apps/api/prisma/**` →
  `pnpm db:migrate`; `.harness/**` → `pnpm harness:check`;
  mudanças em código de runtime → `pnpm test`. O hook é habilitado
  por `pnpm postmerge:install` (idempotente, define
  `core.hooksPath`); desativado localmente via
  `git config --local --unset core.hooksPath`. Spec arquivada em
  `.openspec/specs/harness/post-merge-pull-workflow.md`. Hook
  entregue nos commits `ff0acf0` (scaffolding), `866dba8` (script),
  `48897da` (postmerge:install), `346615e` (quickstart docs).

- **ddd-hexagonal-audit-fixes** — Rodada 1 de achados de auditoria
  contra a skill ddd-hexagonal. Fecha: (F1) dois use cases não
  testados no contexto `users` (`GetUserHistoryUseCase`,
  `RestoreUserUseCase`) agora têm specs unit; (F2)
  `AUTH_CONTEXT_CONFIG` migrado de token string puro para
  `Symbol("AuthContextConfig")` em `auth-context.tokens.ts`;
  (F3) `jwt-access-token.issuer.ts` trocado de `import type` para
  `import` runtime em seu parâmetro de construtor `JwtService`,
  batendo com a convenção usada por todo outro arquivo consumidor
  de DI no projeto. Nenhuma mudança de runtime. Os quatro gates de
  verificação verdes: `pnpm test` 204/204, `pnpm lint` 5/5,
  `pnpm typecheck` 6/6, `pnpm harness:check` 16 PASS / 0 FAIL.
  Spec arquivada em
  `.openspec/specs/api/ddd-hexagonal-audit-fixes.md`. Entregue
  em 5 commits (`5124e35` spec F1.a, `3a7515e` spec F1.b,
  `dab14f9` refactor F2, `87751fb` refactor F3, `3f09e00` lint
  cleanup).

- **complexity-gate** — Adiciona um gate permanente de
  complexidade ciclomática no threshold 10 (default SonarSource).
  Três camadas de defesa: (a) a regra `complexity` builtin do ESLint
  em `packages/config-eslint/base.js` é herdada por todo config de
  workspace, então `pnpm lint` (turbo) falha por workspace em
  qualquer função acima do threshold; (b) novo INC-027 em
  `.harness/check.sh` roda o mesmo check no nível do repo (falha
  `pnpm harness:check`); (c) novo script `.githooks/pre-push`
  bloqueia `git push` local com a mesma regra. Escolha de
  ferramenta: ESLint builtin (zero nova dep). Nota de numeração: o
  proposal original citava INC-019, mas INC-019..INC-022 são slots
  reservados na rotulagem de sub-checks do detector L2 — o próximo
  slot livre é INC-027. Spec arquivada em
  `.openspec/specs/harness/complexity-gate.md`. Entregue em 4
  commits: `1a9252d` regra de config, `01ebd1a` INC-027,
  `5f265a0` hook pre-push, commit de arquivamento abaixo. Gates
  verificados: `pnpm test` 204/204, `pnpm lint` 5/5 (forçado,
  sem cache turbo), `pnpm typecheck` 6/6 (forçado),
  `pnpm harness:check` 17 PASS / 0 FAIL. Baseline: zero funções
  existentes excediam o threshold, então o gate foi seguro para
  habilitar sem remediação.

- **pre-push-test-gate** — Estende `.githooks/pre-push` com quatro
  novos passos ordenados após o check de complexidade existente:
  (1) `pnpm up` (`docker compose up -d` idempotente); (2) espera
  por Postgres pronto, auto-selecionando o probe mais forte
  disponível (pg_isready → psql → bash `/dev/tcp`);
  (3) `pnpm test` (turbo, unit + integration em todos os
  workspaces); (4) `pnpm --filter @ai-padrao/api test:e2e`
  contra o Postgres recém-subido. Checagem de toolchain
  estendida para exigir `docker`. Bypass inalterado:
  `git push --no-verify`. Spec arquivada em
  `.openspec/specs/harness/pre-push-test-gate.md`. Entregue no
  commit `a958b8c`. Gates verificados: `pnpm test` 204/204,
  `pnpm lint` 5/5 (forçado), `pnpm typecheck` 6/6 (forçado),
  `pnpm harness:check` 17 PASS / 0 FAIL. `git push origin main`
  real exerceu o hook end-to-end (5 passos, 12 s, push sucedido).
  Red-green verificado por DoD: teste unit falhando → step 4 FAIL;
  teste e2e falhando → step 5 FAIL; Postgres pausado → probe TCP
  passa (fraco de propósito), step 5 captura a falha real.
