import { execSync } from "node:child_process";
import * as path from "node:path";

/**
 * Teardown global da suíte de testes de integração. Espelha o setup:
 * derruba o banco descartável quando a suíte termina (best-effort).
 */
export default async function integrationTeardown(): Promise<void> {
  const testUrl = process.env.DATABASE_URL_TEST;
  if (!testUrl) return;

  const dbName = testUrl.match(/\/([^/?]+)(?:\?|$)/)?.[1];
  if (!dbName || dbName === "postgres") return;

  const repoRoot = path.resolve(__dirname, "..", "..", "..");

  try {
    execSync(
      `docker compose exec -T postgres psql -U ai_padrao -d postgres -c "DROP DATABASE IF EXISTS ${dbName};"`,
      { stdio: "inherit", cwd: repoRoot },
    );
  } catch {
    // teardown é best-effort — a próxima rodada vai recriar do zero.
  }
}
