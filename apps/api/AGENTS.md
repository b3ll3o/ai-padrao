# App API — Orientação para Agentes de IA

> **Regras do monorepo:** [`.agents/REGRAS.md`](../../.agents/REGRAS.md)
> são a fonte da verdade. Este arquivo **estende** (nunca enfraquece) as
> regras raiz e foca no app `api`.

Este arquivo é a porta de entrada para IA trabalhar em `apps/api`. A
ordem de leitura recomendada:

1. **[`../../.agents/AGENTS.md`](../../.agents/AGENTS.md)** —
   orientação geral do monorepo (comandos, layout `.agents/`).
2. **[`../../.agents/REGRAS.md`](../../.agents/REGRAS.md)** —
   livro de regras raiz (SDD, sem testes pulados, sem secrets, idioma).
3. **[`./REGRAS.md`](./REGRAS.md)** — regras e boas práticas específicas
   deste app (DDD/hexagonal, NestJS, Prisma, Zod, auth, observabilidade).
4. **[`../../.agents/sdd/AGENTS.md`](../../.agents/sdd/AGENTS.md)** —
   fluxo OpenSpec/SDD ao propor uma mudança.

## Comandos específicos da API

```bash
pnpm --filter @ai-padrao/api typecheck   # type-check
pnpm --filter @ai-padrao/api lint        # lint
pnpm --filter @ai-padrao/api test        # testes unit
pnpm --filter @ai-padrao/api test:integration   # testes de integração (Postgres descartável)
pnpm --filter @ai-padrao/api test:e2e    # testes e2e (Supertest)
pnpm --filter @ai-padrao/api test:coverage   # cobertura ≥80%
pnpm --filter @ai-padrao/api test:all     # unit + integration + e2e em sequência
pnpm --filter @ai-padrao/api prisma:studio   # GUI do Prisma
pnpm db:migrate          # roda migrations Prisma no container
pnpm db:seed             # popula usuário admin
pnpm db:reset            # reset completo do schema (dev)
```

## Estrutura do app

```text
apps/api/
├── src/
│   ├── contexts/         # bounded contexts (auth, users, health, ...)
│   │   └── <context>/
│   │       ├── domain/           # entidades, value objects, ports
│   │       ├── application/      # casos de uso, DTOs
│   │       ├── adapters/
│   │       │   └── inbound/      # controllers, presenters
│   │       └── infrastructure/
│   │           └── adapters/     # Prisma repositories, clients
│   ├── modules/          # cross-cutting (config, observability, etc.)
│   ├── main.ts           # bootstrap NestJS + OTel
│   └── app.module.ts     # composition root global
├── prisma/
│   ├── schema.prisma     # schema do banco
│   ├── migrations/       # migrações versionadas
│   └── seed.ts           # seed idem-potente (dev)
└── test/                 # testes e2e (Supertest + Fastify injector)
```

## Atalho: regras mais cobradas (apps/api)

Se você só puder ler três seções do [`./REGRAS.md`](./REGRAS.md), leia:

1. [§2 Regras de dependência](./REGRAS.md#2-regras-de-dependencia) —
   `domain` não importa NestJS/Prisma/HTTP; sempre via ports.
2. [§5 Boas práticas Prisma](./REGRAS.md#5-boas-praticas-prisma) —
   `schema.prisma` é atualizado **depois** dos schemas Zod.
3. [§7 Logs e erros](./REGRAS.md#7-logs-e-erros) + [§8 Auth](./REGRAS.md#8-auth-e-seguranca) —
   Nest `Logger` (não `console.*`), tokens em cookies httpOnly, sem
   PII em logs.

Quando uma mudança for grande (nova feature, migração hexagonal,
mudança de política de cobertura), abra uma change OpenSpec antes
de codificar.
