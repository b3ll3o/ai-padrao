import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    // Suite unit — `*.spec.{ts,tsx}` colados ao código de produção.
    // A suite de integração roda em um config separado
    // (vitest.integration.config.ts) para isolar escopo e cobertura.
    include: ["src/**/*.{spec,unit-spec}.{ts,tsx}"],
    exclude: [
      "src/**/*.{integration-spec,e2e-spec}.{ts,tsx}",
      "node_modules/**",
      ".next/**",
    ],
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.spec.{ts,tsx}",
        "src/**/*.integration-spec.{ts,tsx}",
        "src/app/layout.tsx",
        "src/app/providers.tsx",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
