# ADR-013: Gate de cobertura de 80% independente por app e por métrica

- **Status:** Aceito
- **Date:** 2026-08-04
- **Tipo de decisão:** Decisão proativa de arquitetura
- **ADRs relacionados:** [ADR-012](./ADR-012-vertical-bounded-contexts.md)

## Contexto

Antes deste ADR, o report de cobertura era uma baseline opt-in por
app. Não havia threshold aplicado nem breakdown por métrica. Isso
criava dois modos de falha recorrentes:

1. **Subcobertura silenciosa.** Um refactor que removesse testes
   podia passar verde desde que a suite rodasse. "Cobertura" era
   um número em um report que ninguém lia.
2. **Média esconde buracos.** Um report combinado de "cobertura do
   monorepo" podia reportar 85% de lines enquanto um app ficava a
   60% — o elo fraco era mascarado pelo forte.

Os dois apps também precisam de gates **independentes**: uma feature
adicionada em `apps/web` não deve poder "pagar" pela dívida de
cobertura em `apps/api`, e vice-versa. Média cross-app deixaria um
app saudável subsidiar um negligenciado.

## Decisão

Cobertura é aplicada **independentemente** por app e por métrica:

- Cada app configura sua própria cobertura do Jest/Vitest com
  thresholds explícitos:
  - `apps/api/jest.config.ts` — `coverageThreshold.global` =
    `{ statements: 80, branches: 80, functions: 80, lines: 80 }`,
    com uma `collectCoverageFrom` explícita que exclui specs e
    `*.module.ts` (arquivos de composition).
  - `apps/web/vitest.config.ts` — `coverage.thresholds` =
    `{ statements: 80, branches: 80, functions: 80, lines: 80 }`,
    com `provider: "v8"` e listas `include`/`exclude` explícitas
    (exclui `*.spec.{ts,tsx}`, `app/layout.tsx`,
    `app/providers.tsx`).
- Um comando raiz único, `pnpm test:coverage`, roda o gate de
  cobertura de cada app em sequência. Ele falha se **qualquer uma
  das métricas em qualquer um dos apps** cair abaixo de 80%.
- CI (`.github/workflows/ci.yml`) roda `pnpm test:coverage` uma
  vez, depois de `pnpm test` e antes de `pnpm build`. O gate
  **não** é rodado de novo a partir do `prebuild` para evitar
  trabalho duplicado no mesmo pipeline — `prebuild` roda a
  checagem equivalente.
- Cada `package.json` de app expõe seu próprio `test:coverage`
  para debug local (ex.: `pnpm --filter @ai-padrao/api
  test:coverage`).

As quatro métricas — statements, branches, functions e lines — são
aplicadas separadamente. Abaixar um threshold, excluir código de
negócio, adicionar diretivas `coverage-ignore` ou escrever testes
sem significado para satisfazer o gate são proibidos.

## Consequências

Positivas:

- Uma regressão de cobertura não pode passar verde em nenhum dos
  apps. O gate falha o build com a métrica exata e o arquivo que o
  runner reporta.
- O modo "app saudável subsidia app negligenciado" é
  estruturalmente impossível — o gate é por app, por métrica.
- Iteração local é rápida: engenheiros rodam `pnpm --filter <app>
  test:coverage` para debugar um único app sem subir os dois.
- CI é honesto sobre o gate. Existe uma fonte da verdade
  (`pnpm test:coverage`), então thresholds de teste não podem
  divergir entre local e CI.

Negativas / trade-offs:

- Código novo PRECISA vir com testes, ou o gate falha. Isso é
  intencional, mas sobe o chão para mudanças "pequenas" — veja
  ADR-012 para a ressalva de DDD pragmático que mantém superfícies
  puramente declarativas isentas de abstrações de domínio
  forçadas.
- Vitest e Jest reportam thresholds levemente diferentes (ex.: a
  métrica branches do v8 vs a de Jest). O chão de 80% é generoso
  o suficiente para que ruído de mismatch de métrica não cause
  falso-negativo, mas as configs por app são versionadas em
  `pnpm-lock.yaml` e precisam se mover juntas.
- O gate aplica um número, não qualidade. Um teste sem significado
  ainda sobe cobertura. Isso é mitigado pela checagem de
  no-skipped-tests e por code review — o gate é necessário mas
  não suficiente.

## Enforcement

- `apps/api/jest.config.ts` e `apps/web/vitest.config.ts`
  declaram os thresholds. Ambos os runners falham o build se
  qualquer threshold não for atingido.
- `pnpm test:coverage` na raiz do repo roda os dois apps em
  sequência.
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda a
  checagem equivalente, `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm test:coverage`, depois `pnpm build` nessa ordem.
  Cobertura é o último gate antes do `pnpm build`.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) lista `pnpm
  test:coverage` entre os comandos de validação e declara os
  quatro thresholds de 80% por app na Definition of Done.
- As regras globais de `REGRAS.md` proíbem baixar os thresholds,
  excluir código de negócio, adicionar diretivas de ignore de
  cobertura, ou escrever testes sem significado.
