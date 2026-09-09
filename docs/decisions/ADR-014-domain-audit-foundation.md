# ADR-014: Fundação de auditoria de domínio — histórico tipado, soft-delete, version

- **Status:** Aceito
- **Date:** 2026-08-04
- **Tipo de decisão:** Decisão proativa de arquitetura
- **ADRs relacionados:** [ADR-012](./ADR-012-vertical-bounded-contexts.md),
  [ADR-013](./ADR-013-independent-80-percent-coverage.md)

## Contexto

A primeira onda de entidades (`User`) precisava apenas de CRUD +
auth. A segunda onda (perfis, sessões, entidades de negócio
relacionadas a usuários) precisava de três capacidades transversais
que antes ficavam como "vamos adicionar por entidade":

1. **Histórico.** Quem mudou `User.email`, quando, de quê para quê?
   Sem uma tabela de eventos tipada, a resposta vive em logs de
   aplicação efêmeros.
2. **Soft-delete.** Apagar `User` precisa ser reversível para
   suporte de "exclusão de conta" e LGPD. Hard-delete em cascata
   perde histórico de auditoria e é frequentemente irreversível
   depois do vacuum do Postgres.
3. **Concorrência otimista.** Dois operadores editando o mesmo
   `User.role` ao mesmo tempo: o último write silenciosamente
   ganha. Sem `version` na linha, perdemos conflitos não
   detectados.

Antes deste ADR, cada entidade futura iria reinventar essas
três capacidades, com inconsistência entre `audit_log`,
`deleted_at` e `version` (nomes divergentes, comportamentos
divergentes, gates de migration divergentes).

## Decisão

Os três capabilities são entregues **uma vez** como fundação
reutilizável, antes das entidades de domínio:

- **Histórico tipado (audit log).** Uma tabela
  `domain_events` (`apps/api/prisma/schema.prisma`) é a fonte
  da verdade para eventos de domínio. Cada linha inclui
  `eventId` (ULID), `eventType` (string tipada), `aggregateId`,
  `aggregateType`, `actorId` (opcional, usuário que executou),
  `payload` (JSONB), `occurredAt` (timestamptz). O contrato do
  payload é publicado em [`packages/contracts`](../../packages/contracts/)
  como schemas Zod (`packages/contracts/src/audit/*.ts`), um
  por evento de domínio. Adapters de infrastructure publicam
  eventos via um `DomainEventPublisherPort`; casos de uso veem
  a port e nunca importam o writer do Prisma diretamente.
- **Soft-delete.** Um mixin Prisma reutilizável
  (`apps/api/prisma/extensions/soft-delete.ts`) estende o
  `PrismaClient` para que toda query por padrão exclua linhas
  com `deletedAt != null`. Expor `withDeleted`, `onlyDeleted`
  e `restore` explicitamente na chamada — soft-delete é opt-out,
  não opt-in. Campos `deletedAt` (`DateTime?`) e `deletedBy`
  (`String?`) são padronizados em todas as entidades root.
- **Concorrência otimista.** Toda entidade root tem um campo
  `version` (`Int @default(1)`). O adapter do repositório
  inclui `version` em seu `where` e o incrementa em
  `update`. Falhas de match propagam como um erro de domínio
  tipado (`ConcurrencyError`) que o caso de uso reescreve como
  um `409 Conflict` para HTTP.

A fundação é publicada como uma **primeira mudança**
(`.openspec/changes/foundation-audit-soft-delete-version/`)
que aterrssa na sequência:

- Schema Prisma: `domain_events` + `version`/`deletedAt`/`deletedBy`
  em entidades root.
- Migration Prisma: gerada via `pnpm db:migrate` e commitada.
- Contrato Zod: `packages/contracts/src/audit/*.ts`.
- Port + adapter: `DomainEventPublisherPort`,
  `PrismaDomainEventPublisher`, adapter wire-up no
  `InfraModule`.
- Mixin: `apps/api/prisma/extensions/soft-delete.ts`.
- Hook de repositório: helper `concurrencyGuard()` aplicado em
  cada repositório Prisma.
- Testes: Testcontainers Postgres + specs cobrindo histórico,
  soft-delete e conflito otimista em pelo menos uma entidade
  (`User`).

## Consequências

Positivas:

- Próxima entidade de domínio aterrissa com auditoria, soft-delete
  e concorrência prontos. A fundação é construída uma vez.
- Histórico é tipado de ponta a ponta: schema Zod em
  `packages/contracts` é importado pelo api (validação na borda)
  e pelo web (intellisense para o que está no `payload`).
- Soft-delete uniformiza comportamento — não há "essa tabela é
  hard-deleted, essa é soft-deleted" dependendo de quem escreveu.
- Conflitos otimistas explícitos revertem para `409 Conflict`,
  não para update silenciosamente perdido.
- A fundação inteira é testada em pelo menos uma entidade;
  extensões futuras confiam nela.

Negativas / trade-offs:

- A fundação adiciona ~3 migrations (`domain_events`,
  `version`, soft-delete fields) e ~3 pacotes Zod para manter.
  Aceitável porque é fundação compartilhada.
- `soft-delete` como mixin Prisma exige disciplina ao
  introduzir novos models — esquecer de aplicar a extensão
  resulta em hard-delete. Mitigado por checagem de ESLint
  custom (regra `require-soft-delete-mixin`) e pelo template
  de model.
- `domain_events` cresce rápido em apps de alto write.
  Particionamento por `occurredAt` é um follow-up (registrado
  como "não decidido" — avaliar volume real primeiro).
- Eventos de domínio falham em ser puramente síncronos. O
  publisher já emite best-effort na mesma transação; um
  outbox + worker é um follow-up se耐久性 virar gargalo.

## Enforcement

- `apps/api/prisma/schema.prisma` declara `domain_events`
  mais `version`/`deletedAt`/`deletedBy` em entidades root.
- `apps/api/prisma/extensions/soft-delete.ts` é a única fonte
  da verdade da extensão. Novos models chamam-no via
  `model Foo extends SoftDelete {}` (snippet documentado).
- `packages/contracts/src/audit/*.ts` é o source-of-truth dos
  payloads de evento. api e web importam do contracts.
- `apps/api/eslint.config.mjs` tem uma regra custom que exige
  `SoftDelete` em modelos Prisma root e proíbe hard-delete
  via `delete()` fora de scripts admin explicitamente
  aprovados.
- As regras globais de `REGRAS.md` proíbem pular a fundação
  ("adicionar entidade sem `version`/`deletedAt`"), acessar
  Prisma de fora de `infra/`, ou introduzir um audit log
  paralelo.
