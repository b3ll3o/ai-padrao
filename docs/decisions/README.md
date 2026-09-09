# Architecture Decision Records (Registros de Decisão de Arquitetura)

Este diretório captura as decisões específicas do projeto que qualquer
assistente de IA ou contribuidor humano deve respeitar ao modificar
este código. Cada ADR é curto, no formato Nygard, e documenta uma
decisão real (geralmente disparada por um defeito real ou estudo de
trade-off).

## Como ler

1. Dê uma olhada rápida na lista abaixo para saber quais ADRs existem.
2. Quando for tocar uma área relacionada, abra o ADR correspondente.
3. A seção "Enforcement" de cada ADR diz qual checagem de code review
   ou CI falha se você violar a regra.

Cada ADR tem quatro seções: **Contexto**, **Decisão**, **Consequências**,
**Enforcement**. Convenções: `Status: Aceito`, `Date: 2026-08-04` para
todos os ADRs deste conjunto inicial.

## Índice (12 ADRs)

| ADR | Título | Tag |
| --- | --- | --- |
| [ADR-001](ADR-001-fastify-reply-api.md) | Usar a API de reply do Fastify, não a Node ServerResponse | nestjs-fastify-gotchas |
| [ADR-002](ADR-002-no-import-type-for-nest-di.md) | Não use `import type` em services injetados pelo Nest | nestjs-fastify-gotchas |
| [ADR-003](ADR-003-public-decorator-on-health-auth.md) | `@Public()` obrigatório em endpoints de health/auth | nestjs-fastify-gotchas |
| [ADR-004](ADR-004-dockerfile-copy-schema-before-generate.md) | Dockerfile: copiar schema do Prisma ANTES de `prisma generate` | pnpm-monorepo-script |
| [ADR-005](ADR-005-non-default-ports.md) | Host ports fora do padrão em `docker-compose.yml` | pnpm-monorepo-script |
| [ADR-006](ADR-006-nest-logger-not-console.md) | Usar o `Logger` do Nest, não `console.*` em `main.ts` | nestjs-fastify-gotchas |
| [ADR-007](ADR-007-no-skipped-tests.md) | Tolerância zero: sem skipped/todo/`--passWithNoTests` | REGRAS.md §Sem testes pulados |
| [ADR-011](ADR-011-no-plaintext-secrets-in-source.md) | Sem tokens em texto puro no source | REGRAS.md §Sem secrets em texto puro |
| [ADR-012](ADR-012-vertical-bounded-contexts.md) | Contextos delimitados verticais (DDD-hexagonal) | ddd-hexagonal |
| [ADR-013](ADR-013-independent-80-percent-coverage.md) | Gate de 80% de cobertura independente por app + métrica | testing |
| [ADR-014](ADR-014-domain-audit-foundation.md) | Auditoria de domínio: histórico tipado, soft-delete, version | api-design |
| [ADR-015](ADR-015-bind-mount-prisma-dir-in-api-container.md) | Bind-mount de `apps/api/prisma/` no container da api | docker-dev-loop |

## Os três ADRs de maior tráfego

Se você é uma assistente de IA e só consegue ler três ADRs, leia:

1. **ADR-007 — Sem testes pulados.** Disparado toda vez que alguém
   escreve um teste.
2. **ADR-002 — Não use `import type` para DI do Nest.** Disparado toda
   vez que alguém refatora imports sob `apps/api/`.
3. **ADR-006 — Use o `Logger` do Nest, não `console.*`.** Disparado
   toda vez que alguém edita `apps/api/src/main.ts`.

## Quando adicionar um ADR novo

Quando você encontrar um padrão recorrente, um trade-off não óbvio ou
um defeito com tendência a se repetir, rascunhe um ADR. Adicione o
arquivo em `docs/decisions/`, liste-o na tabela de Índice acima e
link o código afetado via `@remarks` em JSDoc.
