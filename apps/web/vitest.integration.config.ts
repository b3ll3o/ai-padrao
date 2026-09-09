import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Configuração da suíte de testes de integração do app web.
 *
 * Roda via `pnpm --filter @ai-padrao/web test:integration`. Cobre
 * `*.integration-spec.{ts,tsx}` — adapters de infrastructure exercitados
 * com dependências reais (msw para HTTP, jsdom para cookies).
 *
 * Mantida separada da config unit (vitest.config.ts) para isolar escopo
 * e para que a cobertura unitária não seja inflada por specs que tocam
 * infra. Veja `.agents/REGRAS.md §9` e `apps/web/REGRAS.md §13`.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.integration-spec.{ts,tsx}"],
    exclude: [
      "src/**/*.{spec,unit-spec,e2e-spec}.{ts,tsx}",
      "node_modules/**",
      ".next/**",
    ],
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      // Cobertura da suíte de integração é reportada em separado; o gate
      // de 80% continua sendo da suíte unit (`test:coverage`).
      include: ["src/**/*.{ts,tsx}"],
    },
  },
});
