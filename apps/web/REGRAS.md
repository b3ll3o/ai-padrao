# Regras do App Web (`apps/web`)

> **Regras do monorepo:** [`../../.agents/REGRAS.md`](../../.agents/REGRAS.md)
> são a fonte da verdade. Este arquivo **estende** (nunca enfraquece) as
> regras raiz e foca no app web.

> **Orientação rápida:** [`./AGENTS.md`](./AGENTS.md) é o índice de
> orientação. Leia primeiro o AGENTS.md, depois este REGRAS.md.

## Índice

1. [Arquitetura obrigatória](#1-arquitetura-obrigatoria)
2. [Regras de dependência](#2-regras-de-dependencia)
3. [Server vs Client Components](#3-server-vs-client-components)
4. [Pastas e convenções](#4-pastas-e-convencoes)
5. [Camada de dados (data fetching)](#5-camada-de-dados-data-fetching)
6. [Formulários e validação](#6-formularios-e-validacao)
7. [Auth e sessão](#7-auth-e-sessao)
8. [UI, Tailwind e acessibilidade](#8-ui-tailwind-e-acessibilidade)
9. [Estado e cache](#9-estado-e-cache)
10. [Performance e SEO](#10-performance-e-seo)
11. [Segurança client-side](#11-seguranca-client-side)
12. [Logs e erros](#12-logs-e-erros)
13. [Pirâmide de testes obrigatória (unit + integração + e2e)](#13-piramide-de-testes-obrigatoria)
14. [Cobertura mínima](#14-cobertura-minima)
15. [Checklist de PR para o web](#15-checklist-de-pr-para-o-web)
16. [Fluxo de mudança](#16-fluxo-de-mudanca)

---

## 1. Arquitetura obrigatória

O app web DEVE seguir Domain-Driven Design (DDD) e arquitetura
hexagonal para as funcionalidades que contêm comportamento de
negócio. Novas funcionalidades DEVEM ser organizadas como contextos
de feature verticais (vertical feature contexts). Features existentes
migram incrementalmente sem alterar rotas ou contratos de API, a
menos que um delta OpenSpec aprovado os altere explicitamente.

Um feature context DEVE usar esta forma:

```text
features/<context>/
├── domain/                  # entidades, value objects, invariantes
├── application/             # casos de uso, view models, orquestração
├── adapters/
│   └── presentation/        # páginas, componentes, formulários, hooks
└── infrastructure/
    └── adapters/            # cliente HTTP, cookies, navegação, storage
```

Aplique DDD de frontend de forma pragmática. Páginas e componentes
puramente apresentacionais não precisam de entidades, value objects
ou casos de uso artificiais. Introduza abstrações de domínio só para
comportamento real, invariantes e fluxos com regras.

## 2. Regras de dependência

Dependências DEVEM apontar para dentro:

```text
adapters presentation -> application -> domain
adapters infrastructure -> application/domain ports
composition root -> todas as camadas
```

- `domain/` NÃO PODE importar React, Next.js, APIs de browser,
  clientes HTTP, bibliotecas de renderização ou código de
  infraestrutura.
- `application/` DEVE depender apenas de tipos do `domain/` e de
  `ports` declaradas, nunca de transporte concreto, cookies,
  navegação ou implementação de framework.
- Páginas, componentes, formulários, hooks e view models são
  adapters presentation. NÃO PODEM conter regras de domínio.
- Clientes HTTP, acesso a cookies, browser storage, integração
  com server e navegação são adapters de infrastructure atrás de
  ports.
- Páginas do App Router e factories funcionam como composition
  roots onde dependências são montadas.
- Schemas compartilhados de request e response DEVEM continuar
  vindo de `packages/contracts`.
- Tokens de autenticação DEVEM permanecer em cookies httpOnly e
  NUNCA em `localStorage` ou `sessionStorage`.
- Uma feature DEVE expor um contrato de aplicação explícito e
  NÃO PODE importar adapters internos de outra feature.
- Código em locais compartilhados (`shared/`, `lib/`) DEVE ser
  neutro de framework ou genuinamente cross-cutting. Não use
  `shared` para furar fronteiras de feature.

## 3. Server vs Client Components

- **Padrão default:** Server Components. Cliente apenas quando
  necessário (interatividade, estado, efeitos, browser APIs).
- Marque Client Components com `"use client"` **apenas** no topo
  do arquivo; nunca misture em um componente que deve ser Server.
- Server Components podem chamar `fetch` direto do servidor,
  acessar cookies/headers e usar clientes de dados server-side.
- Client Components recebem apenas **props serializáveis** — não
  passe objetos com métodos, instâncias ou símbolos.
- Composições de UI puramente estáticas ficam em `packages/ui`
  (Server-friendly) e são reusadas por ambas as apps.
- Não exponha segredos via props para Client Components — apenas
  dados derivados/publicáveis.

## 4. Pastas e convenções

- **Feature context:** `src/features/<context>/{domain,
  application,adapters, infrastructure}/...`
- **Rotas (App Router):** `src/app/<rota>/page.tsx`,
  `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`.
- **Pastas `presentation`:** `pages/`, `components/`, `hooks/`,
  `view-models/`.
- **Pastas `infrastructure`:** `http/`, `cookies/`, `storage/`,
  `analytics/`.
- **Pastas `domain`:** `entities/`, `value-objects/`, `events/`,
  `errors/`, `ports/`.
- **Pastas `application`:** `use-cases/`, `view-models/`.
- **Componentes de UI primitivos:** `packages/ui`
  (`packages/ui/src/components/`).
- Convenção de nomenclatura igual ao da API:
  - Arquivos em `kebab-case`.
  - Classes em `PascalCase`.
  - DTOs com sufixo `<Recurso>Dto`.
  - Ports: `<Recurso><Papel>` (`AuthRepository`, `SessionStorage`,
    `AnalyticsTracker`).
  - Adapters: sufixo com a tecnologia (`KyAuthRepository`,
    `HttpOnlyCookieSessionStorage`).

## 5. Camada de dados (data fetching)

- Toda chamada à API passa por um **client tipado** que re-exporta
  os schemas Zod de `packages/contracts`. Nunca importe `ky`,
  `fetch` ou `axios` direto em `presentation` ou `application`.
- Server Components usam o client em **modo servidor**, encaminhando
  cookies via `cookies()` do `next/headers`. Não exponha o client
  ao browser sem querer.
- Trate erros de rede com exceções tipadas em `domain/erros` ou
  `application/errors`. A página ou componente de erro
  (`error.tsx`) lida com a UX.
- Cache: use `fetch` com `{ next: { revalidate, tags } }` ou
  `cache: 'no-store'`. Documente a estratégia em ADR ao introduzir
  cache novo.
- Evite duplicar dados entre server fetch e client state — prefira
  Server Components para dados iniciais e mutações com
  `revalidatePath`/`revalidateTag`.

## 6. Formulários e validação

- Schemas de validação ficam em `packages/contracts` (Zod). O web
  importa e reusa — não duplica.
- Para formulários ricos, use **react-hook-form** + `zodResolver`.
  Erros são exibidos em pt-br; mensagens vêm do schema.
- Validação client-side é para UX. A **validação real** acontece
  na API (server-side). Nunca confie só no client.
- Submissão faz parte do caso de uso (`application/use-cases/`) ou
  é resolvida via Server Action tipada pelo contrato.

## 7. Auth e sessão

- Tokens vivem em cookies httpOnly — código de autenticação NÃO os
  toca via `document.cookie`.
- Refresh de sessão é feito pelo adapter de cookies quando o
  client HTTP receber `401` na resposta — centralize essa lógica
  em uma única função do adapter.
- Logout limpa cookie server-side via Server Action ou endpoint
  dedicado; não remova apenas o cookie local.
- Guards de rota: prefira checagem no `layout.tsx` ou `page.tsx`
  server-side, redirecionando via `redirect()` do
  `next/navigation`. Nada de guarda escondida em CSS.
- Use metadata apropriadado em páginas públicas (`generateMetadata`)
  para SEO; nunca exponha dados sensíveis via `<meta>` ou
  `data-*`.

## 8. UI, Tailwind e acessibilidade

- Componentes em `packages/ui` são primitivos neutros (shadcn/ui +
  Tailwind 4). Estenda-os, não duplique-os em `apps/web`.
- Use utilitário `cn()` ou `cN()` de `packages/ui` para merge de
  classes (`tailwind-merge` + `clsx`).
- Mantenha variantes via `class-variance-authority` (CVA) quando o
  componente tiver mais de 3 estilos relevantes.
- Acessibilidade (a11y) é **obrigatória**:
  - Todo elemento interativo tem rótulo (`aria-label`, `aria-
    labelledby`) ou `htmlFor`/`id` em inputs.
  - Contraste mínimo AA (4.5:1 texto, 3:1 UI).
  - Foco visível (`focus-visible:ring-2`).
  - Foco gerenciado em modais/dropdowns (trap focus, Esc fecha).
  - Imagens com `alt` descritivo.
  - Formulários com `<label>` e mensagens de erro em
    `aria-describedby`.
- Mensagens e textos da UI em pt-br.
- Não use cores hard-coded em componentes — use tokens do tema
  (`bg-background`, `text-foreground`, `border-input` etc.).

## 9. Estado e cache

- Server-first: estado compartilhado entre rotas mora no server.
- Estado efêmero de UI (formulários, modais, hover, tabs) vive em
  Client Components com hooks locais.
- Para estado compartilhado entre Client Components na mesma
  árvore: Context quando pequeno, TanStack Query quando vem de
  rede com cache e invalidação.
- Evite `[zustand, jotai, redux]` para estado que o servidor já
  conhece — passe a derivar no server.
- Estados derivados DEVEM ser puros (`useMemo`/`useCallback`
  apenas quando o cálculo for caro).

## 10. Performance e SEO

- Prefira imagens via `next/image`. Configure `priority` apenas
  para LCP.
- Fontes via `next/font` com `display: 'swap'`. Não importe
  Google Fonts via `<link>`.
- Streaming: use `<Suspense>` para árvores lentas e deixe o
  App Router enviar HTML incremental.
- Reduza JS de cliente: páginas sem interatividade devem ser
  Server Components sem um único `"use client"`.
- Use Lighthouse localmente para fluxos críticos (login, busca,
  checkout). Meta: boa pontuação de accessibility, best practices e
  SEO em mobile.
- `metadata` exportada por página pública; nunca exponha
  segredos via metadata.

## 11. Segurança client-side

- Sem `dangerouslySetInnerHTML` sem sanitização explícita.
- Sem `eval`, `new Function`, `document.write` em produção.
- Sem URLs externas sem validação — bloqueie `javascript:` em
  `href`s.
- Sem import de pacotes npm fora do lockfile (`pnpm install`
  valida integridade).
- Tokens, Authorization headers e cookies sensíveis **nunca** vão
  para o client (`console.log(window.localStorage)` em dev é vetado
  pelos adapters).
- Política CSP configurada uma vez no `next.config.ts` (verifique
  em PR que mexe em headers).

## 12. Logs e erros

- Logs do navegador apenas em desenvolvimento (`if
  (process.env.NODE_ENV !== 'production')`).
- Erros globais via `app/error.tsx` e `app/global-error.tsx` com
  UI consistente e link de retorno.
- Não logue payloads completos em produção; o erro vai para
  observabilidade da API via `requestId`/`traceId`.
- Mensagens da UI em pt-br (idioma padrão do projeto).

## 13. Pirâmide de testes obrigatória (unit + integração + e2e)

A regra canônica vive em
[`../../.agents/REGRAS.md` §9](../../.agents/REGRAS.md#9-piramide-de-testes-obrigatoria).
Este §13 aplica aquela regra ao app `web` em três níveis:

### 13.1 Unit (Vitest + jsdom + Testing Library)

- Localização: `*.spec.ts` / `*.spec.tsx` colado ao arquivo de produção
  em `src/features/<context>/...` ou `src/components/...`.
- Domínio: 100% puro — sem React, sem Next, sem rede. Cobre entidades,
  value objects, invariantes e domain services.
- Aplicação: casos de uso com **fakes** ou ports em memória
  determinísticos; sem React, sem rede.
- Adapters presentation: formulários, hooks, view models e componentes
  críticos (comportamentais) usando `@testing-library/react`. Renderize
  a árvore real, não faça mock de componente interno para validar UI.
- Fluxos críticos cobertos: login, registro, sessão, refresh, logout
  e redirecionamentos — estes valem regressão por bugfix.
- Enforcement: imports proibidos (React/Next/etc. em `domain/`) são
  checados via ESLint (`apps/web/eslint.config.mjs`).
- Regressão: cada bugfix vem com um teste que falha antes do fix e
  passa depois.
- Comando: `pnpm --filter @ai-padrao/web test`.

### 13.2 Integração (msw + infra real quando aplicável)

- Localização: `*.integration-spec.tsx` em `src/features/<context>/infrastructure/`
  ou `test/integration/`.
- Adapters infrastructure (clientes HTTP, cookies, navegação) DEVEM ser
  exercitados contra `msw` (Mock Service Worker) em modo servidor com
  handlers HTTP realistas — não vale mockar `fetch` à mão.
- Cookies httpOnly e storage de browser: use `@vitest/browser` ou
  `jsdom` configurado para o contexto do app; cada teste limpa o
  storage em `beforeEach`.
- Comandos: `pnpm --filter @ai-padrao/web test:integration`.

### 13.3 e2e (Playwright + browser real)

- Localização: `*.e2e-spec.tsx` em `apps/web/e2e/` ou `apps/web/test/e2e/`.
- Ferramenta: **Playwright** (Chromium, Firefox, WebKit). O navegador
  sobe de verdade contra um servidor de dev real (`pnpm dev` em
  paralelo ou build de produção).
- Cada e2e cobre uma jornada inteira: Server Component → fetch →
  resposta tipada → render → interação do usuário. Pelo menos um caso
  feliz + um caso de erro esperado (validação, redirect quando não
  autenticado).
- O fluxo de login é parte do setup padrão: a maioria das páginas
  exige sessão; o teste usa um helper `loginAs(page, email)` que
  registra um usuário via API e injeta o cookie de sessão no contexto
  do navegador.
- Não stub nada em e2e — a API pode ser apontada para um servidor
  descartável (Testcontainers / docker-compose.test) ou para um
  mock-server (msw em modo servidor) **apenas** quando a API não está
  disponível. Em CI, a API roda via Testcontainers.
- Comando: `pnpm --filter @ai-padrao/web test:e2e`.
- **Estado atual (2026-09-09):** o web ainda não adotou `@playwright/test`.
  O script `test:e2e` em `apps/web/package.json` aponta para
  `apps/web/test/e2e-placeholder.mjs`, que imprime uma mensagem de
  status e sai com código 0 para não quebrar `test:all`. Esta lacuna é
  intencional: a suíte de **integração** (`test:integration`, §13.2)
  cobre hoje o ciclo real do adapter HTTP contra um servidor HTTP
  local, então a regra de "dependência real" da raiz (§9.4) está
  satisfeita para o adapter de auth. Quando o Playwright for adotado
  (mudança rastreada em uma change OpenSpec futura), este placeholder
  é substituído por `playwright.config.ts` + specs em `apps/web/e2e/`,
  e o script volta a ser `playwright test`.

### 13.4 Comandos canônicos

| Comando                             | O que roda                                              |
| ----------------------------------- | ------------------------------------------------------- |
| `pnpm --filter @ai-padrao/web test`             | suite unit (Vitest + Testing Library) |
| `pnpm --filter @ai-padrao/web test:integration` | suite integration (msw + infra real)   |
| `pnpm --filter @ai-padrao/web test:e2e`         | suite e2e (Playwright)                |
| `pnpm --filter @ai-padrao/web test:coverage`    | unit + cobertura com gate ≥80%         |
| `pnpm --filter @ai-padrao/web test:all`         | unit + integration + e2e em sequência  |

A regra raiz de **tolerância zero a testes pulados** vale
integralmente.

## 14. Cobertura mínima

`apps/web` DEVE manter, de forma independente, no mínimo **80%** em
cada métrica:

- statements: 80%
- branches: 80%
- functions: 80%
- lines: 80%

CI e `pnpm --filter @ai-padrao/web test:coverage` DEVEM falhar se
qualquer métrica estiver abaixo. Cobertura de outro workspace ou
app **não** compensa shortfall do web.

Exclusões de cobertura se limitam a código gerado, declaration
files, configuração declarativa e composition roots que contenham
apenas fiação de dependência. Lógica de negócio, casos de uso,
adapters, ramos de erro, modelos de domínio, formulários e
componentes comportamentais NÃO PODEM ser excluídos para bater o
threshold. Cada exclusão precisa ser explícita e justificada.

Não baixe thresholds, não adicione diretivas de ignore, não
escreva testes sem assertiva para fazer a cobertura passar.

## 15. Checklist de PR para o web

Antes de pedir review, confirme:

- [ ] `pnpm --filter @ai-padrao/web typecheck` e `lint` limpos.
- [ ] `pnpm --filter @ai-padrao/web test` verde.
- [ ] Coverage ≥80% em todas as métricas (CI valida).
- [ ] Fluxos críticos cobertos (login/refresh/logout/etc.).
- [ ] Sem `"use client"` desnecessário — server-first mantido.
- [ ] Componentes `packages/ui` reusados em vez de duplicados.
- [ ] A11y verificada (labels, foco, contraste).
- [ ] Sem tokens/segredos em browser-only paths.
- [ ] Sem `.skip`/`.todo`/`xit`/`xdescribe` (regra raiz).
- [ ] Strings de UI em pt-br (regra raiz de idioma).

## 16. Fluxo de mudança

Migrações DDD/hexagonais e mudanças em enforcement de cobertura
afetam comportamento ou política de build. Exigem um change
OpenSpec aprovado em `.openspec/changes/<feature>/` antes da
implementação, conforme as regras raiz.
