import { execSync } from "node:child_process";
import * as path from "node:path";

/**
 * Setup global da suíte de testes de integração (apps/api).
 *
 * Provisiona um banco Postgres descartável para que cada execução de
 * `pnpm --filter @ai-padrao/api test:integration` rode contra dependências
 * reais (não mocks). Convenção:
 *
 *   - DATABASE_URL_TEST  → URL completa do banco descartável.
 *   - DATABASE_URL_ADMIN → URL administrativa (banco default `postgres`)
 *     usada apenas para criar/dropar o banco descartável.
 *
 * Sem esses envs, o setup falha rápido em vez de mascarar drift entre
 * Prisma client e schema (regra §9 da raiz: teste com dependência real
 * ou não conte como integração).
 */
export default async function integrationSetup(): Promise<void> {
  const testUrl = process.env.DATABASE_URL_TEST;
  const adminUrl = process.env.DATABASE_URL_ADMIN;

  if (!testUrl || !adminUrl) {
    throw new Error(
      "Defina DATABASE_URL_TEST e DATABASE_URL_ADMIN antes de rodar `test:integration`. " +
        "Exemplo: DATABASE_URL_TEST=postgresql://ai_padrao:ai_padrao_dev@localhost:5432/ai_padrao_test " +
        "DATABASE_URL_ADMIN=postgresql://ai_padrao:ai_padrao_dev@localhost:5432/postgres",
    );
  }

  const dbName = parseDbName(testUrl);
  if (!dbName || dbName === "postgres") {
    throw new Error(
      `DATABASE_URL_TEST aponta para o banco "${dbName}", que não é descartável. ` +
        "Use um nome dedicado (ex.: ai_padrao_test) — o setup vai dropar e recriar.",
    );
  }

  // `docker compose` precisa ser executado a partir da raiz do monorepo
  // (onde está o `docker-compose.yml`). Os scripts da api rodam em
  // `apps/api`, então subimos dois níveis.
  const repoRoot = path.resolve(__dirname, "..", "..", "..");

  // (re)cria o banco descartável via psql no contêiner Postgres do compose.
  execSync(
    `docker compose exec -T postgres psql -U ai_padrao -d postgres -c "DROP DATABASE IF EXISTS ${dbName};"`,
    { stdio: "inherit", cwd: repoRoot },
  );
  execSync(
    `docker compose exec -T postgres psql -U ai_padrao -d postgres -c "CREATE DATABASE ${dbName};"`,
    { stdio: "inherit", cwd: repoRoot },
  );

  // Aplica o schema via `prisma db push` (rápido o suficiente para um
  // banco descartável; `migrate deploy` também funciona).
  execSync("pnpm exec prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}

function parseDbName(url: string): string | null {
  const match = url.match(/\/([^/?]+)(?:\?|$)/);
  return match?.[1] ?? null;
}
