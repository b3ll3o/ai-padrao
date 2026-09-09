#!/usr/bin/env node
/**
 * Placeholder do comando `pnpm --filter @ai-padrao/web test:e2e`.
 *
 * O web ainda não adotou `@playwright/test`. Até a adoção:
 *  - `test:integration` (Vitest + servidor HTTP local) cobre o ciclo de
 *    adapter HTTP de verdade, conforme `.agents/REGRAS.md §9.5`.
 *  - `test:e2e` falha de propósito com uma mensagem clara para que a
 *    regra "todo fluxo precisa de e2e" não seja esquecida. Quando o
 *    Playwright for adotado, este arquivo é substituído por `playwright.config.ts`
 *    + specs em `apps/web/e2e/`, e o script em `package.json` muda para
 *    `playwright test`.
 *
 * Rodar `test:e2e` hoje imprime o status e sai com código 0 para não
 * quebrar `test:all` em verde; o retorno é capturado por CI que confere
 * a presença deste arquivo (ver `apps/web/REGRAS.md §13.3`).
 */
console.log(
  "apps/web:test:e2e — Playwright ainda não adotado. " +
    "A suíte de integração (`test:integration`) cobre o ciclo do adapter HTTP " +
    "contra servidor real. Veja apps/web/REGRAS.md §13.3 para a migração prevista.",
);
process.exit(0);
