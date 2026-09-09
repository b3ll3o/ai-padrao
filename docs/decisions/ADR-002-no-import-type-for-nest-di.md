# ADR-002 — Não use `import type` em services injetados pelo NestJS

- **Status:** Aceito
- **Date:** 2026-08-04

## Contexto

O NestJS depende de `emitDecoratorMetadata: true` para emitir as
referências `design:paramtypes` para os parâmetros do construtor. O
JavaScript emitido referencia o _valor_ do import em runtime. O
`import type { Foo }` do TypeScript apaga o valor do JS emitido,
substituindo `Object` no slot do tipo. O container de DI do NestJS
não consegue resolver o provider, exibindo o erro críptico
"Nest can't resolve dependencies of the XService (?)" no primeiro
boot.

`@typescript-eslint/consistent-type-imports` está correto para a
maioria do código — mas o auto-fix não conhece a fronteira de
framework, e quebra silenciosamente todo service injetado em
`pnpm lint --fix`.

## Decisão

Em qualquer arquivo sob `apps/api/src/modules/**` que exporte uma
classe do NestJS (controller, service, guard, interceptor, strategy,
decorator), imports de services injetados DEVEM ser valores em
runtime:

```ts
import { PrismaService } from "../prisma/prisma.service"; // valor em runtime
import type { SomeType } from "../types"; // tipo puro apenas
```

A regra do eslint está correta no espírito mas errada aqui. Suprima-a
nas linhas relevantes com
`// eslint-disable-next-line @typescript-eslint/consistent-type-imports`.

## Consequências

- **Mais fácil:** DI continua funcionando; `pnpm lint --fix` é seguro.
- **Mais difícil:** Separar imports por uso tem um custo pequeno.
- **Trade-off:** Aceitar — a alternativa (uma dispensa global do
  eslint) derrotaria a regra para todo mundo.

## Enforcement

- Skill: `nestjs-fastify-gotchas` Gotcha 1.
- Não existe checagem automatizada para esta regra — exigiria uma
  regra TypeScript-aware que conheça fronteiras de framework; review
  manual.
