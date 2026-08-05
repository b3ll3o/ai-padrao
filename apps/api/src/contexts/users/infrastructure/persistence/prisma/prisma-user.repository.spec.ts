import { PrismaUserRepository } from "./prisma-user.repository";
import type { PrismaService } from "../../../../../infra/prisma/prisma.service";
import type { UserListQuery } from "@ai-padrao/contracts";
import { User } from "../../../domain/entities/user";
import { UserNotDeletedError } from "../../../domain/errors/user-not-deleted.error";
import { UserNotFoundError } from "../../../domain/errors/user-not-found.error";

/**
 * Build a PrismaUserRepository backed by a hand-rolled mock client.
 * `$transaction` is mocked by accepting a callback and providing a tx
 * object with the same model accessors as the outer client (mirroring
 * real Prisma behaviour for the unit tests).
 */
function buildRepo() {
  // Outer accessors — read paths use these.
  const user = {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  const userHistory = { create: jest.fn(), findMany: jest.fn() };

  // Independent inner tx accessors — production code calls txUser.update /
  // txUserHistory.create inside $transaction. Keeping them separate
  // (rather than aliasing) lets the test assert each side properly.
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
    it("returns mapped Users with pagination + filter metadata", async () => {
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

    it("forwards q as case-insensitive OR on email+name", async () => {
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
    it("returns null when no row matches", async () => {
      const { repo, user } = buildRepo();
      user.findUnique.mockResolvedValue(null);
      expect(await repo.findById("missing")).toBeNull();
    });

    it("maps a found row to a User", async () => {
      const { repo, user } = buildRepo();
      user.findUnique.mockResolvedValue(userRow({ id: "u1" }));
      const result = await repo.findById("u1");
      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe("u1");
    });
  });

  describe("findByIdIncludingDeleted", () => {
    it("returns even deleted rows", async () => {
      const { repo, user } = buildRepo();
      user.findUnique.mockResolvedValue(
        userRow({ deletedAt: new Date("2024-06-01") }),
      );
      const result = await repo.findByIdIncludingDeleted("u1");
      expect(result?.deletedAt).toEqual(new Date("2024-06-01"));
    });

    it("returns null when the row is missing", async () => {
      const { repo, user } = buildRepo();
      user.findUnique.mockResolvedValue(null);
      expect(await repo.findByIdIncludingDeleted("missing")).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("normalizes the email and returns the mapped User", async () => {
      const { repo, user } = buildRepo();
      user.findUnique.mockResolvedValue(userRow({ email: "a@a.com" }));
      const result = await repo.findByEmail("  A@A.COM ");
      expect(user.findUnique).toHaveBeenCalledWith({
        where: { email: "a@a.com" },
        select: expect.objectContaining({ id: true, email: true }),
      });
      expect(result?.email.value).toBe("a@a.com");
    });

    it("returns null when nothing matches", async () => {
      const { repo, user } = buildRepo();
      user.findUnique.mockResolvedValue(null);
      expect(await repo.findByEmail("nope@nope.com")).toBeNull();
    });
  });

  describe("update()", () => {
    it("runs inside $transaction and writes an UPDATE history entry", async () => {
      const { repo, prisma, user, userHistory, txUser, txUserHistory } =
        buildRepo();
      txUser.findUnique.mockResolvedValue(userRow({ version: 2 }));
      txUser.update.mockResolvedValue(userRow({ version: 3, name: "Alice2" }));
      txUserHistory.create.mockResolvedValue({});

      const result = await repo.update("u1", { name: "Alice2" }, "admin-1");

      // Verify $transaction was used
       
      expect((prisma as any).$transaction).toHaveBeenCalledTimes(1);

      // Verify the update incremented version and forwarded the patch
      expect(user.update).not.toHaveBeenCalled();
      expect(txUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u1" },
          data: { name: "Alice2", version: { increment: 1 } },
        }),
      );

      // Verify history capture happened with the prior snapshot and new version
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

    it("uses null changedBy when actorId is omitted", async () => {
      const { repo, txUser, txUserHistory } = buildRepo();
      txUser.findUnique.mockResolvedValue(userRow({ version: 2 }));
      txUser.update.mockResolvedValue(userRow({ version: 3, name: "Alice2" }));
      txUserHistory.create.mockResolvedValue({});
      await repo.update("u1", { name: "Alice2" });
      expect(txUserHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ changedBy: null }),
      });
    });

    it("forwards only the email patch when name is undefined", async () => {
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

    it("forwards only the name patch when email is undefined", async () => {
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

    it("sends an empty patch (only version bump) when both fields are undefined", async () => {
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

    it("throws UserNotFoundError when prior row is missing", async () => {
      const { repo, txUser } = buildRepo();
      txUser.findUnique.mockResolvedValue(null);
      await expect(
        repo.update("missing", { name: "X" }),
      ).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });

  describe("softDelete()", () => {
    it("flips deletedAt, bumps version, and writes a DELETE history entry", async () => {
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

    it("uses null changedBy when actorId is omitted", async () => {
      const { repo, txUser, txUserHistory } = buildRepo();
      txUser.findUnique.mockResolvedValue(userRow());
      txUser.update.mockResolvedValue(userRow({ deletedAt: new Date() }));
      txUserHistory.create.mockResolvedValue({});
      await repo.softDelete("u1");
      expect(txUserHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ changedBy: null }),
      });
    });

    it("throws UserNotFoundError when prior row is missing", async () => {
      const { repo, txUser } = buildRepo();
      txUser.findUnique.mockResolvedValue(null);
      await expect(repo.softDelete("missing")).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });
  });

  describe("restore()", () => {
    it("clears deletedAt, bumps version, and writes a RESTORE history entry", async () => {
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

    it("throws UserNotDeletedError if the user is already active", async () => {
      const { repo, txUser } = buildRepo();
      txUser.findUnique.mockResolvedValue(userRow({ deletedAt: null }));
      await expect(repo.restore("u1")).rejects.toBeInstanceOf(
        UserNotDeletedError,
      );
    });

    it("throws UserNotFoundError when prior row is missing", async () => {
      const { repo, txUser } = buildRepo();
      txUser.findUnique.mockResolvedValue(null);
      await expect(repo.restore("missing")).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });

    it("uses null changedBy when actorId is omitted", async () => {
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
    it("returns rows ordered by version ascending and maps them to DTOs", async () => {
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
