# Regras de `packages/contracts`

> **Regras do monorepo:** [`../../.agents/REGRAS.md`](../../.agents/REGRAS.md)
> são a fonte da verdade. Este arquivo **estende** (nunca enfraquece) as
> regras raiz e foca no pacote `contracts`.

Pacote que centraliza os schemas Zod compartilhados entre `apps/api`
e `apps/web`. **Source of truth** para toda forma de request/response
e contratos de domínio serializáveis.

## Índice

1. [Quando mexer aqui](#1-quando-mexer-aqui)
2. [Organização](#2-organizacao)
3. [Estilo de schema](#3-estilo-de-schema)
4. [Versionamento e breaking changes](#4-versionamento-e-breaking-changes)
5. [Publicação](#5-publicacao)
6. [Testes](#6-testes)
7. [Checklist de PR](#7-checklist-de-pr)

---

## 1. Quando mexer aqui

- **Toda** mudança de contrato HTTP público (rota, request,
  response, payload de erro).
- **Toda** mudança em tipo compartilhado entre api e web (DTOs de
  domínio, enums, shapes de evento).
- Mudanças no `schema.prisma` da api DEVEM ser precedidas pela
  atualização dos schemas equivalentes aqui (regra das ações
  proibidas — não modifique `schema.prisma` sem coordenar com os
  contratos em `packages/contracts`).
- **Não** colocar aqui: tipos efêmeros de UI, classes com métodos
  (comportamento), ou tipos derivados de implementação (DTOs Prisma
  crus, modelos ORM).

## 2. Organização

```text
packages/contracts/src/
├── auth/         # login, refresh, etc.
├── users/        # CRUD de usuários
├── common/       # pagination, errors, enums compartilhados
└── index.ts      # barrel export público
```

- Cada **bounded context** na api tem sua pasta espelhada aqui.
- Barrel `index.ts` re-exporta o que é público. Nada vaza para fora
  sem ser exportado.
- Tipos inferidos (`z.infer<typeof X>`) ficam próximos do schema
  (`type X = ...`).

## 3. Estilo de schema

- Use **Zod 4** (versão instalada). Helpers centralizados em
  `common/zod-helpers.ts` quando repetidos (ex.: `emailSchema`,
  `passwordSchema`, `paginationSchema`).
- Mensagens de erro **em pt-br** (idioma padrão do projeto) — exceto
  quando o consumidor é um sistema externo com contrato fixo em
  inglês.
- Schemas de request/response sempre exportam o **type** inferido
  também (`type LoginRequest = z.infer<typeof loginRequestSchema>`).
- Prefira `z.object({...}).strict()` quando quiser bloquear campos
  extras (mais seguro para APIs).
- Use `z.discriminatedUnion` para variantes (ex.: tipo de evento).
- Use `z.brand<'UserId'>` ou `z.string().uuid().brand<'UserId'>()`
  para IDs — evita misturar IDs de contextos diferentes.
- Para timestamps: `z.string().datetime()` (ISO 8601) na fronteira
  HTTP; converta para `Date` apenas no domain da api.
- IDs no JSON são `string` (uuid v4 ou v7); inteiros só quando o
  storage os exige e isso está documentado.
- Enum Zod deve espelhar o enum Prisma; mantenha-os em sincronia.

## 4. Versionamento e breaking changes

- Mudanças **breaking** no contrato DEVEM abrir uma change
  OpenSpec (`/openspec/changes/<feat>/...`) **antes** do código
  da api/web ser tocado.
- Mudanças aditivas (campos opcionais, novas rotas, novos eventos)
  podem ser feitas com Conventional Commits no escopo `contracts`
  sem change OpenSpec completa — a menos que o seed/template do
  projeto diga o contrário.
- Mudanças em enum (adicionar valor é aditiva; remover ou renomear
  valor é breaking) seguem a mesma regra.
- Comentário `/** @since <versão> */` em cada schema documenta
  quando entrou; ajuda a api/web a auditar uso.

## 5. Publicação

- O pacote é consumido internamente via workspace do pnpm.
- Não publique no npm registry sem decisão explícita em ADR.
- Exports públicos via `packages/contracts/src/index.ts`.
- Build: `tsc -p tsconfig.json` para gerar `dist/`. Tipos ficam em
  `dist/types/` ou inline (`declaration: true`).

## 6. Testes

- Teste **os schemas**, não a api nem o web. Foco: aceita o input
  válido, rejeita o inválido com mensagem correta.
- Casos de borda: `null`, `undefined`, campos faltando, tipos
  errados, valores fora de faixa, strings vazias onde não fazem
  sentido.
- Use o `jest.config.ts` local. Vitest pode ser aceitável se a api
  usar Vitest — alinhar com o resto do monorepo.

## 7. Checklist de PR

- [ ] Schemas novos/alterados têm testes novos/alterados.
- [ ] Breaking changes têm change OpenSpec aprovada.
- [ ] `schema.prisma` atualizado **depois** do(s) schema(s) Zod
      (e migrado pelo adapter).
- [ ] Mensagens de erro em pt-br (idioma padrão).
- [ ] Barrel export atualizado quando há schema novo.
- [ ] `pnpm --filter @ai-padrao/contracts build` verde.
- [ ] Tipos inferidos (`type Foo = z.infer<...>`) exportados
      quando a api/web precisam.
