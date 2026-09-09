# App Web — Orientação para Agentes de IA

> **Regras do monorepo:** [`.agents/REGRAS.md`](../../.agents/REGRAS.md)
> são a fonte da verdade. Este arquivo **estende** (nunca enfraquece) as
> regras raiz e foca no app `web`.

Este arquivo é a porta de entrada para IA trabalhar em `apps/web`. A
ordem de leitura recomendada:

1. **[`../../.agents/AGENTS.md`](../../.agents/AGENTS.md)** —
   orientação geral do monorepo (comandos, layout `.agents/`).
2. **[`../../.agents/REGRAS.md`](../../.agents/REGRAS.md)** —
   livro de regras raiz (SDD, sem testes pulados, sem secrets, idioma).
3. **[`./REGRAS.md`](./REGRAS.md)** — regras e boas práticas específicas
   deste app (DDD/hexagonal, Next.js, Server vs Client Components,
   Tailwind/a11y, auth via cookies).
4. **[`../../.agents/sdd/AGENTS.md`](../../.agents/sdd/AGENTS.md)** —
   fluxo OpenSpec/SDD ao propor uma mudança.

## Comandos específicos do web

```bash
pnpm --filter @ai-padrao/web typecheck   # type-check
pnpm --filter @ai-padrao/web lint        # lint
pnpm --filter @ai-padrao/web test        # testes (Vitest)
pnpm --filter @ai-padrao/web test:coverage   # cobertura ≥80%
pnpm --filter @ai-padrao/web build       # build de produção Next.js
pnpm --filter @ai-padrao/web start       # servidor de produção
```

## Estrutura do app

```text
apps/web/
├── src/
│   ├── app/                       # App Router (pages, layouts, etc.)
│   │   ├── (public)/              # grupo de rotas públicas
│   │   ├── (auth)/                # grupo de rotas autenticadas
│   │   ├── layout.tsx             # layout raiz
│   │   └── globals.css            # CSS global + tokens
│   ├── features/                  # bounded contexts web
│   │   └── <context>/
│   │       ├── domain/
│   │       ├── application/
│   │       ├── adapters/
│   │       │   └── presentation/  # páginas, componentes, hooks
│   │       └── infrastructure/    # HTTP, cookies, storage
│   └── components/                # componentes cross-cutting (não-UI)
├── public/                        # assets estáticos
├── next.config.ts                 # config Next.js
└── vitest.config.ts               # config de testes
```

## Atalho: regras mais cobradas (apps/web)

Se você só puder ler três seções do [`./REGRAS.md`](./REGRAS.md), leia:

1. [§3 Server vs Client Components](./REGRAS.md#3-server-vs-client-components) —
   Server-first; `"use client"` só quando precisar interagir.
2. [§7 Auth e sessão](./REGRAS.md#7-auth-e-sessao) —
   tokens em cookies httpOnly, **nunca** em `localStorage`.
3. [§8 UI, Tailwind e acessibilidade](./REGRAS.md#8-ui-tailwind-e-acessibilidade) —
   primitivos de `packages/ui`, tokens de tema, a11y AA obrigatória.

Quando uma mudança for grande (nova feature, migração hexagonal,
mudança de política de cobertura), abra uma change OpenSpec antes
de codificar.
