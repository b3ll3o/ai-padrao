// Teste de integração para PrismaUserRepository contra Postgres real.
//
// Roda via `pnpm --filter @ai-padrao/api test:integration` (config em
// `apps/api/test/jest-integration.json`). Requer DATABASE_URL_TEST
// apontando para um banco descartável criado pelo globalSetup.
//
// O globalSetup já fez `prisma db push`. Aqui instanciamos um PrismaService
// real (não mocks), exercitamos o adapter contra o schema do banco, e
// truncamos as tabelas entre testes para isolamento.

import { PrismaService } from "../../../../../infra/prisma/prisma.service";
import { PrismaUserRepository } from "./prisma-user.repository";
import { User } from "../../../domain/entities/user";
import { UserNotDeletedError } from "../../../domain/errors/user-not-deleted.error";
import { UserNotFoundError } from "../../../domain/errors/user-not-found.error";

const TEST_URL = process.env.DATABASE_URL_TEST;
if (!TEST_URL) {
  throw new Error(
    "DATABASE_URL_TEST não definido — `test:integration` exige o globalSetup em apps/api/test/integration-setup.ts",
  );
}

// PrismaService (estende PrismaClient) lê DATABASE_URL do process.env.
// O setup.ts já garante que DATABASE_URL aponta para o dev DB; aqui
// redirecionamos para o banco descartável apenas para a vida desta spec.
process.env.DATABASE_URL = TEST_URL;
const prisma = new PrismaService();

// Trunca todas as tabelas relevantes antes de cada teste. Mais barato e
// mais previsível do que transações (quebram com `$transaction(async tx …)`
// usado pelo adapter, que precisa enxergar o próprio resultado da tx).
beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "users_history", "refresh_tokens", "users" RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});

const seed = async (
  over: {
    id?: string;
    email?: string;
    name?: string;
    role?: "USER" | "ADMIN";
    passwordHash?: string;
    deletedAt?: Date | null;
  } = {},
) => {
  const row = await prisma.user.create({
    data: {
      id: over.id ?? `u-${Math.random().toString(36).slice(2, 10)}`,
      email:
        over.email ??
        `seed-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      name: over.name ?? "Seed",
      role: over.role ?? "USER",
      passwordHash: over.passwordHash ?? "hashed:placeholder",
      deletedAt: over.deletedAt ?? null,
    },
  });
  return row;
};

describe("PrismaUserRepository (integração)", () => {
  const repo = new PrismaUserRepository(prisma);

  describe("list()", () => {
    it("retorna Users paginados e o total real do banco", async () => {
      await seed({ name: "Alice" });
      await seed({ name: "Bob" });
      await seed({ name: "Carol" });

      const page1 = await repo.list({ page: 1, pageSize: 2 });
      expect(page1.total).toBe(3);
      expect(page1.items).toHaveLength(2);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(2);
      expect(page1.items[0]).toBeInstanceOf(User);

      const page2 = await repo.list({ page: 2, pageSize: 2 });
      expect(page2.items).toHaveLength(1);
    });

    it("filtra soft-deleted por padrão (deletedAt IS NULL)", async () => {
      await seed({ name: "Alive" });
      await seed({ name: "Ghost", deletedAt: new Date("2024-06-01") });

      const result = await repo.list({ page: 1, pageSize: 20 });
      expect(result.total).toBe(1);
      expect(result.items[0]?.name.value).toBe("Alive");
    });

    it("filtra por q case-insensitive em email e name", async () => {
      await seed({ email: "alice@example.com", name: "Alice" });
      await seed({ email: "bob@example.com", name: "Bob" });

      const byEmail = await repo.list({
        page: 1,
        pageSize: 20,
        q: "ALICE",
      });
      expect(byEmail.total).toBe(1);
      expect(byEmail.items[0]?.email.value).toBe("alice@example.com");

      const byName = await repo.list({ page: 1, pageSize: 20, q: "bo" });
      expect(byName.total).toBe(1);
      expect(byName.items[0]?.name.value).toBe("Bob");
    });
  });

  describe("findById()", () => {
    it("retorna null quando a linha não existe", async () => {
      expect(await repo.findById("missing")).toBeNull();
    });

    it("retorna null para uma linha soft-deleted (filtro do port)", async () => {
      const seeded = await seed({ deletedAt: new Date() });
      expect(await repo.findById(seeded.id)).toBeNull();
    });

    it("mapeia a linha encontrada para um User", async () => {
      const seeded = await seed({ name: "Mapped" });
      const result = await repo.findById(seeded.id);
      expect(result).toBeInstanceOf(User);
      expect(result?.name.value).toBe("Mapped");
    });
  });

  describe("findByIdIncludingDeleted()", () => {
    it("retorna linhas soft-deleted", async () => {
      // `deletedAt` precisa ser >= `createdAt` (invariante da entidade).
      // Usamos `Date.now() + offset` para garantir a ordem mesmo com
      // clocks lentos no setup do teste.
      const deletedAt = new Date(Date.now() + 60_000);
      const seeded = await seed({ deletedAt });
      const result = await repo.findByIdIncludingDeleted(seeded.id);
      expect(result?.deletedAt?.toISOString()).toBe(deletedAt.toISOString());
    });
  });

  describe("findByEmail()", () => {
    it("normaliza o email antes de consultar", async () => {
      const seeded = await seed({ email: "find@example.com" });
      const result = await repo.findByEmail("  FIND@EXAMPLE.COM ");
      expect(result?.id).toBe(seeded.id);
    });

    it("retorna null quando nada corresponde", async () => {
      expect(await repo.findByEmail("nope@nope.com")).toBeNull();
    });
  });

  describe("update()", () => {
    it("atualiza o usuário, incrementa versão e grava histórico UPDATE", async () => {
      const seeded = await seed({ name: "Old" });

      const updated = await repo.update(seeded.id, { name: "New" }, "admin-1");

      expect(updated.name.value).toBe("New");
      expect(updated.version).toBe(seeded.version + 1);

      // Histórico persistido (não mock) — confirma que $transaction + audit
      // chegaram no banco.
      const history = await prisma.userHistory.findMany({
        where: { originalId: seeded.id },
        orderBy: { version: "asc" },
      });
      expect(history).toHaveLength(1);
      expect(history[0]?.operation).toBe("UPDATE");
      expect(history[0]?.changedBy).toBe("admin-1");
      expect(history[0]?.version).toBe(seeded.version + 1);
    });

    it("lança UserNotFoundError quando o id não existe", async () => {
      await expect(
        repo.update("missing", { name: "X" }),
      ).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });

  describe("softDelete()", () => {
    it("marca deletedAt, incrementa versão e grava histórico DELETE", async () => {
      const seeded = await seed();
      await repo.softDelete(seeded.id, "admin-1");

      // O `auditExtension` esconde linhas soft-deleted de `findUnique` no
      // model `user`; reler exige o sentinela `INCLUDE_DELETED_FLAG` ou o
      // port `findByIdIncludingDeleted`. Usamos o port — é a superfície
      // pública do repositório, exercita o sentinela e nos dá o entity
      // mapeado de graça.
      const reloaded = await repo.findByIdIncludingDeleted(seeded.id);
      expect(reloaded?.deletedAt).not.toBeNull();
      expect(reloaded?.version).toBe(seeded.version + 1);

      const history = await prisma.userHistory.findMany({
        where: { originalId: seeded.id },
        orderBy: { version: "asc" },
      });
      expect(history).toHaveLength(1);
      expect(history[0]?.operation).toBe("DELETE");
    });
  });

  describe("restore()", () => {
    it("limpa deletedAt, incrementa versão e grava histórico RESTORE", async () => {
      const seeded = await seed({ deletedAt: new Date("2024-07-01") });

      const result = await repo.restore(seeded.id, "admin-1");

      expect(result.deletedAt).toBeNull();
      expect(result.version).toBe(seeded.version + 1);

      const history = await prisma.userHistory.findMany({
        where: { originalId: seeded.id },
        orderBy: { version: "asc" },
      });
      // 1 entrada: a do restore. (Soft-delete original não passou por este adapter.)
      expect(history).toHaveLength(1);
      expect(history[0]?.operation).toBe("RESTORE");
    });

    it("lança UserNotDeletedError quando a linha não está soft-deleted", async () => {
      const seeded = await seed();
      await expect(repo.restore(seeded.id)).rejects.toBeInstanceOf(
        UserNotDeletedError,
      );
    });
  });

  describe("getHistory()", () => {
    it("retorna entradas ordenadas por versão ascendente", async () => {
      const seeded = await seed();
      await repo.update(seeded.id, { name: "v2" }, "admin-1");
      await repo.softDelete(seeded.id, "admin-1");
      await repo.restore(seeded.id, "admin-1");

      const history = await repo.getHistory(seeded.id);
      expect(history).toHaveLength(3);
      expect(history.map((h) => h.operation)).toEqual([
        "UPDATE",
        "DELETE",
        "RESTORE",
      ]);
      // Garantia de ordem ascendente por versão.
      expect(history[0]?.version).toBeLessThan(history[1]?.version ?? 0);
      expect(history[1]?.version).toBeLessThan(history[2]?.version ?? 0);
    });
  });
});
