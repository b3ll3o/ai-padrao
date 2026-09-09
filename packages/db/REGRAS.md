# Regras de `packages/db`

> **Regras do monorepo:** [`../../.agents/REGRAS.md`](../../.agents/REGRAS.md)
> são a fonte da verdade. Este arquivo **estende** (nunca enfraquece) as
> regras raiz e foca no pacote `db`.

Pacote que centraliza o **cliente Prisma** e utilitários de banco
compartilhados (seed, helpers de transação, factories de teste). Apenas
`apps/api` consome este pacote; o web **não** importa daqui.

## Índice

1. [O que vive aqui](#1-o-que-vive-aqui)
2. [Cliente Prisma](#2-cliente-prisma)
3. [Migrações](#3-migracoes)
4. [Seed e factories](#4-seed-e-factories)
5. [Transações e isolamento](#5-transacoes-e-isolamento)
6. [Observabilidade](#6-observabilidade)
7. [Segurança](#7-seguranca)
8. [Testes](#8-testes)
9. [Checklist de PR](#9-checklist-de-pr)

---

## 1. O que vive aqui

- Wrapper tipado do `PrismaClient` (re-export ou classe fina).
- Helpers de boot/shutdown idempotentes.
- Seed oficial (quando local) e factories para testes.
- Utilitários comuns de migração e reset.
- **Nada** de lógica de negócio ou DTOs de domínio aqui. Esse
  pacote é puramente "infraestrutura de banco".

## 2. Cliente Prisma

- Exporte **uma** instância singleton para uso em runtime
  (`PrismaClient` configurado com log levels do env).
- Aceite override via Dependency Injection para testes
  (parâmetro de factory).
- Configure `log: ['warn', 'error']` por padrão; deixe
  `info`/`query` apenas quando `PRISMA_LOG=query`.
- Habilite `__internal` features com parcimônia (e somente via
  comentário de justificativa).
- Não exponha tipos `Prisma.*` crus para fora do pacote — faça
  wrapper ou importe somente em adapters da api (regras do
  `apps/api/REGRAS.md`).

## 3. Migrações

- Source of truth: `apps/api/prisma/schema.prisma`. **Este pacote
  não define schema.**
- Comandos de migração rodam no container da api (`pnpm
  db:migrate`, `pnpm db:reset`); nada no `packages/db` tenta rodar
  Prisma CLI por conta própria.
- Não edite migração já mergeada; crie uma nova corretiva.
- Em CI, `prisma migrate deploy` valida que migrações pendentes
  existem antes de subir o app.

## 4. Seed e factories

- Seed oficial é idempotente (usa `upsert` em vez de `create`).
- Use dados realistas — emails `*@example.com`, CPFs/CNPJs
  fictícios quando contexto brasileiro exigir.
- Factories de teste (ex.: `makeUserFixture`) ficam aqui para
  compartilhamento entre `apps/api` e possíveis scripts locais;
  cada fixture retorna o objeto com defaults sobrescrevíveis.

## 5. Transações e isolamento

- Helper `withTransaction(async (tx) => ...)` quando o app quiser
  escopo explícito de transação; nunca exponha `prisma.$transaction`
  cru para adapters.
- Em testes, prefira **rollback por transação** em vez de resetar o
  banco inteiro entre specs (mais rápido, mais determinístico).

## 6. Observabilidade

- Habilite spans OTel do Prisma via instrumentação automática
  (`@prisma/instrumentation`); spans DEVEM carregar nome de modelo
  e operação.
- Métricas: contador de queries lentas, histograma de duração por
  modelo são úteis em produção; documente em ADR ao introduzir.

## 7. Segurança

- Variáveis de banco (`DATABASE_URL`, `DIRECT_URL`) ficam em `.env`,
  nunca commitadas.
- Service role ou usuário de migração com escopo limitado; **nunca**
  use usuário admin do banco em runtime.
- Sem PII em logs do Prisma — `log: ['query']` em produção deve
  ser desabilitado ou agressivamente redatado.

## 8. Testes

- Teste do pacote `db` foca nos **helpers** (transação, seed,
  factories). Não há domain tests aqui.
- Integração opcional usa Testcontainers Postgres via
  `@testcontainers/postgresql` ou serviço em compose.
- Cobertura segue a regra global ≥80% quando aplicável.

## 9. Checklist de PR

- [ ] Mudança em helper exposto acompanhada de teste.
- [ ] Sem mudança em `schema.prisma` (vive na api); se precisar,
      abra change OpenSpec primeiro (regra das ações proibidas).
- [ ] Sem `console.*` (Nest `Logger` quando log de boot for
      necessário).
- [ ] Singleton de `PrismaClient` continua configurável para testes.
- [ ] `pnpm --filter @ai-padrao/db typecheck` e `lint` limpos.
