import { PrismaUserRepository } from "./prisma-user.repository";
import type { PrismaService } from "../../../../../infra/prisma/prisma.service";
import type { UserListQuery } from "@ai-padrao/contracts";
import { User } from "../../../domain/entities/user";
import { UserNotDeletedError } from "../../../domain/errors/user-not-deleted.error";
import { UserNotFoundError } from "../../../domain/errors/user-not-found.error";

/**
 * Constrói um PrismaUserRepository apoiado por um cliente mock escrito à mão.
 * `$transaction` é mockado aceitando um callback e fornecendo um objeto tx
 * com os mesmos accessors de model que o cliente externo (espelhando o
 * comportamento real do Prisma para os testes unitários).
 */
function buildRepo() {
  // Accessors externos — os caminhos de leitura os utilizam.
  const user = {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  const userHistory = { create: jest.fn(), findMany: jest.fn() };

  // Accessors internos independentes da tx — o código de produção chama
  // txUser.update / txUserHistory.create dentro de $transaction. Mantê-los
  // separados (em vez de aliasar) permite que o teste valide cada lado.
  const txUser = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  const txUserHistory = { create: jest.fn(), findMany: jest.fn() };
  const tx = { user: txUser, userHistory: txUserHistory };

  const prisma = {
    user,
    userHistory,

    $transaction: jest.fn(async (cb: any) => cb(tx)) as any,
  } as unknown as PrismaService;

  const repo = new PrismaUserRepository(prisma);
  return { repo, user, userHistory, txUser, txUserHistory, tx, prisma };
}

function userRow(
  over: Partial<{
    id: string;
    email: string;
    name: string;
    role: "USER" | "ADMIN";
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    version: number;
  }> = {},
) {
  return {
    id: over.id ?? "u1",
    email: over.email ?? "a@a.com",
    name: over.name ?? "Alice",
    role: over.role ?? "USER",
    createdAt: over.createdAt ?? new Date("2024-01-01T00:00:00Z"),
    updatedAt: over.updatedAt ?? new Date("2024-01-01T00:00:00Z"),
    deletedAt: over.deletedAt ?? null,
    version: over.version ?? 0,
  };
}

describe("PrismaUserRepository", () => {
  describe("list()", () => {
    it("retorna Users mapeados com metadados de paginação + filtro", async () => {
      const { repo, user } = buildRepo();
      const rows = [userRow(), userRow({ id: "u2", email: "b@b.com" })];
      user.findMany.mockResolvedValue(rows);
      user.count.mockResolvedValue(42);

      const q: UserListQuery = { page: 2, pageSize: 10 };
      const result = await repo.list(q);

      expect(user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          skip: 10,
          take: 10,
          orderBy: { createdAt: "desc" },
        }),
      );
      expect(user.count).toHaveBeenCalledWith({ where: {} });
      expect(result.total).toBe(42);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toBeInstanceOf(User);
    });

    it("encaminha q como OR case-insensitive em email+name", async () => {
      const { repo, user } = buildRepo();
      user.findMany.mockResolvedValue([]);
      user.count.mockResolvedValue(0);
      await repo.list({ page: 1, pageSize: 20, q: "al" });
      expect(user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: { contains: "al", mode: "insensitive" } },
              { name: { contains: "al", mode: "insensitive" } },
            ],
          },
        }),
      );
    });
  });

  describe("findById", () => {
    it("retorna null quando nenhuma linha corresponde", async () => {
      const { repo, user } = buildRepo();
      user.findUnique.mockResolvedValue(null);
      expect(await repo.findById("missing")).toBeNull();
    });

    it("mapeia uma linha encontrada para um User", async () => {
      const { repo, user } = buildRepo();
      user.findUnique.mockResolvedValue(userRow({ id: "u1" }));
      const result = await repo.findById("u1");
      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe("u1");
    });
  });

  describe("findByIdIncludingDeleted", () => {
    it("retorna mesmo linhas deletadas", async () => {
      const { repo, user } = buildRepo();
      user.findUnique.mockResolvedValue(
        userRow({ deletedAt: new Date("2024-06-01") }),
      );
      const result = await repo.findByIdIncludingDeleted("u1");
      expect(result?.deletedAt).toEqual(new Date("2024-06-01"));
    });

    it("retorna null quando a linha não existe", async () => {
      const { repo, user } = buildRepo();
      user.findUnique.mockResolvedValue(null);
      expect(await repo.findByIdIncludingDeleted("missing")).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("normaliza o email e retorna o User mapeado", async () => {
      const { repo, user } = buildRepo();
      user.findUnique.mockResolvedValue(userRow({ email: "a@a.com" }));
      const result = await repo.findByEmail("  A@A.COM ");
      expect(user.findUnique).toHaveBeenCalledWith({
        where: { email: "a@a.com" },
        select: expect.objectContaining({ id: true, email: true }),
      });
      expect(result?.email.value).toBe("a@a.com");
    });

    it("retorna null quando nada corresponde", async () => {
      const { repo, user } = buildRepo();
      user.findUnique.mockResolvedValue(null);
      expect(await repo.findByEmail("nope@nope.com")).toBeNull();
    });
  });

  describe("update()", () => {
    it("executa dentro de $transaction e grava uma entrada de histórico UPDATE", async () => {
      const { repo, prisma, user, userHistory, txUser, txUserHistory } =
        buildRepo();
      txUser.findUnique.mockResolvedValue(userRow({ version: 2 }));
      txUser.update.mockResolvedValue(userRow({ version: 3, name: "Alice2" }));
      txUserHistory.create.mockResolvedValue({});

      const result = await repo.update("u1", { name: "Alice2" }, "admin-1");

      // Verifica que $transaction foi usado

      expect((prisma as any).$transaction).toHaveBeenCalledTimes(1);

      // Verifica que o update incrementou a versão e encaminhou o patch
      expect(user.update).not.toHaveBeenCalled();
      expect(txUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u1" },
          data: { name: "Alice2", version: { increment: 1 } },
        }),
      );

      // Verifica que a captura de histórico aconteceu com o snapshot anterior e a nova versão
      expect(userHistory.create).not.toHaveBeenCalled();
      expect(txUserHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          originalId: "u1",
          version: 3,
          operation: "UPDATE",
          changedBy: "admin-1",
        }),
      });
      expect(result).toBeInstanceOf(User);
      expect(result.name.value).toBe("Alice2");
      expect(result.version).toBe(3);
    });

    it("usa changedBy como null quando actorId é omitido", async () => {
      const { repo, txUser, txUserHistory } = buildRepo();
      txUser.findUnique.mockResolvedValue(userRow({ version: 2 }));
      txUser.update.mockResolvedValue(userRow({ version: 3, name: "Alice2" }));
      txUserHistory.create.mockResolvedValue({});
      await repo.update("u1", { name: "Alice2" });
      expect(txUserHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ changedBy: null }),
      });
    });

    it("encaminha apenas o patch de email quando name é undefined", async () => {
      const { repo, txUser, txUserHistory } = buildRepo();
      txUser.findUnique.mockResolvedValue(userRow({ version: 0 }));
      txUser.update.mockResolvedValue(userRow({ version: 1 }));
      txUserHistory.create.mockResolvedValue({});
      await repo.update("u1", { email: "x@x.com" });
      expect(txUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { email: "x@x.com", version: { increment: 1 } },
        }),
      );
    });

    it("encaminha apenas o patch de name quando email é undefined", async () => {
      const { repo, txUser, txUserHistory } = buildRepo();
      txUser.findUnique.mockResolvedValue(userRow({ version: 0 }));
      txUser.update.mockResolvedValue(userRow({ version: 1 }));
      txUserHistory.create.mockResolvedValue({});
      await repo.update("u1", { name: "Bob" });
      expect(txUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: "Bob", version: { increment: 1 } },
        }),
      );
    });

    it("envia um patch vazio (apenas incremento de versão) quando ambos os campos são undefined", async () => {
      const { repo, txUser, txUserHistory } = buildRepo();
      txUser.findUnique.mockResolvedValue(userRow({ version: 0 }));
      txUser.update.mockResolvedValue(userRow({ version: 1 }));
      txUserHistory.create.mockResolvedValue({});
      await repo.update("u1", {});
      expect(txUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { version: { increment: 1 } },
        }),
      );
    });

    it("lança UserNotFoundError quando a linha anterior não existe", async () => {
      const { repo, txUser } = buildRepo();
      txUser.findUnique.mockResolvedValue(null);
      await expect(
        repo.update("missing", { name: "X" }),
      ).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });

  describe("softDelete()", () => {
    it("inverte deletedAt, incrementa versão e grava entrada de histórico DELETE", async () => {
      const { repo, prisma, txUser, txUserHistory } = buildRepo();
      txUser.findUnique.mockResolvedValue(userRow({ version: 4 }));
      txUser.update.mockResolvedValue(
        userRow({ version: 5, deletedAt: new Date("2024-07-01") }),
      );
      txUserHistory.create.mockResolvedValue({});

      await repo.softDelete("u1", "admin-1");

      expect((prisma as any).$transaction).toHaveBeenCalledTimes(1);
      expect(txUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u1" },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            version: { increment: 1 },
          }),
        }),
      );
      expect(txUserHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          originalId: "u1",
          version: 5,
          operation: "DELETE",
          changedBy: "admin-1",
        }),
      });
    });

    it("usa changedBy como null quando actorId é omitido", async () => {
      const { repo, txUser, txUserHistory } = buildRepo();
      txUser.findUnique.mockResolvedValue(userRow());
      txUser.update.mockResolvedValue(userRow({ deletedAt: new Date() }));
      txUserHistory.create.mockResolvedValue({});
      await repo.softDelete("u1");
      expect(txUserHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ changedBy: null }),
      });
    });

    it("lança UserNotFoundError quando a linha anterior não existe", async () => {
      const { repo, txUser } = buildRepo();
      txUser.findUnique.mockResolvedValue(null);
      await expect(repo.softDelete("missing")).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });
  });

  describe("restore()", () => {
    it("limpa deletedAt, incrementa versão e grava entrada de histórico RESTORE", async () => {
      const { repo, prisma, txUser, txUserHistory } = buildRepo();
      txUser.findUnique.mockResolvedValue(
        userRow({ version: 5, deletedAt: new Date("2024-07-01") }),
      );
      txUser.update.mockResolvedValue(userRow({ version: 6 }));
      txUserHistory.create.mockResolvedValue({});

      const result = await repo.restore("u1", "admin-1");

      expect((prisma as any).$transaction).toHaveBeenCalledTimes(1);
      expect(txUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u1" },
          data: expect.objectContaining({
            deletedAt: null,
            version: { increment: 1 },
          }),
        }),
      );
      expect(txUserHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          originalId: "u1",
          version: 6,
          operation: "RESTORE",
          changedBy: "admin-1",
        }),
      });
      expect(result.deletedAt).toBeNull();
      expect(result.version).toBe(6);
    });

    it("lança UserNotDeletedError se o usuário já está ativo", async () => {
      const { repo, txUser } = buildRepo();
      txUser.findUnique.mockResolvedValue(userRow({ deletedAt: null }));
      await expect(repo.restore("u1")).rejects.toBeInstanceOf(
        UserNotDeletedError,
      );
    });

    it("lança UserNotFoundError quando a linha anterior não existe", async () => {
      const { repo, txUser } = buildRepo();
      txUser.findUnique.mockResolvedValue(null);
      await expect(repo.restore("missing")).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });

    it("usa changedBy como null quando actorId é omitido", async () => {
      const { repo, txUser, txUserHistory } = buildRepo();
      txUser.findUnique.mockResolvedValue(
        userRow({ deletedAt: new Date("2024-07-01") }),
      );
      txUser.update.mockResolvedValue(userRow({ version: 1 }));
      txUserHistory.create.mockResolvedValue({});
      await repo.restore("u1");
      expect(txUserHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ changedBy: null }),
      });
    });
  });

  describe("getHistory()", () => {
    it("retorna linhas ordenadas pela versão crescente e mapeia para DTOs", async () => {
      const { repo, userHistory } = buildRepo();
      const rows = [
        {
          id: "h1",
          originalId: "u1",
          version: 1,
          operation: "CREATE",
          changedAt: new Date("2024-01-01"),
          changedBy: null,
          snapshot: { id: "u1", email: "a@a.com" },
        },
        {
          id: "h2",
          originalId: "u1",
          version: 2,
          operation: "UPDATE",
          changedAt: new Date("2024-02-01"),
          changedBy: "admin-1",
          snapshot: { id: "u1", email: "a2@a.com" },
        },
      ];
      userHistory.findMany.mockResolvedValue(rows);
      const result = await repo.getHistory("u1");
      expect(userHistory.findMany).toHaveBeenCalledWith({
        where: { originalId: "u1" },
        orderBy: { version: "asc" },
      });
      expect(result).toHaveLength(2);
      expect(result[0]?.changedAt).toEqual(new Date("2024-01-01"));
      expect(result[0]?.operation).toBe("CREATE");
      expect(result[1]?.changedBy).toBe("admin-1");
    });
  });
});
