# ADR-007 — Tolerância zero: sem skipped/todo/`--passWithNoTests` em código versionado

- **Status:** Aceito
- **Date:** 2026-08-04

## Contexto

Pular testes é contagioso. O primeiro commit que adiciona `.skip()`
para "silenciar a flake" é o mesmo commit que apaga o teste de
regressão que teria pego o próximo bug. O CI então fica verde em uma
suite frágil cuja cobertura real é desconhecida, e refactors passam
em review porque "os testes passam". Seis meses depois ninguém ousa
re-habilitar os testes pulados porque a asserção por baixo apodreceu.

`vitest --passWithNoTests` é o mesmo modo de falha em outra forma:
um pacote com zero testes reporta "passando" e quebra o gate de
cobertura do repo inteiro sem ninguém notar.

## Decisão

Código versionado sob `apps/` e `packages/` NÃO PODE conter:

- `it.skip`, `test.skip`, `describe.skip`, `context.skip`
- `xit`, `xtest`, `xdescribe`, `xtest`
- `it.todo`, `test.todo`
- `vitest.config.{ts,js}` / `jest.config.{ts,js}` com `passWithNoTests: true`
  ou `coverage.skip: true` para arquivos não excluídos
- Scripts em `package.json` que passam `--passWithNoTests` ou
  `--testPathIgnorePatterns` que escondem arquivos falhando

Se um teste precisa ser temporariamente desabilitado (uma flake
conhecida em investigação), delete o teste e referencie o incidente
no ADR relacionado. Re-adicione o teste quando o fix chegar. Não
deixe um cemitério de testes pulados no repo.

## Consequências

- **Mais fácil:** Números de cobertura são reais. CI falha quando um
  teste de regressão some.
- **Mais difícil:** Flakes genuínas precisam ser corrigidas na raiz,
  não silenciadas. Setup por teste é usualmente o culpado.
- **Trade-off:** Aceitar — apodrecimento silencioso de teste é a
  forma mais cara de dívida técnica neste codebase.

## Enforcement

- `REGRAS.md §Sem testes pulados` é a regra human-facing.
- O template de PR exige que o autor confirme "nenhum teste foi
  pulado, stubado ou desabilitado" antes do review.
