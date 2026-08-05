import { PrismaUserRepository } from "./prisma-user.repository";
import type { PrismaService } from "../../../../../infra/prisma/prisma.service";
import type { UserListQuery } from "@ai-padrao/contracts";
import { User } from "../../../domain/entities/user";

describe("PrismaUserRepository", () => {
  const buildRepo = () => {
    const user = {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const prisma = { user } as unknown as PrismaService & { user: typeof user };
    const repo = new PrismaUserRepository(prisma as unknown as PrismaService);
    return { repo, user };
  };

  const userRow = (
    over: Partial<{
      id: string;
      email: string;
      name: string;
      role: "USER" | "ADMIN";
      createdAt: Date;
      updatedAt: Date;
    }> = {},
  ) => ({
    id: over.id ?? "u1",
    email: over.email ?? "a@a.com",
    name: over.name ?? "Alice",
    role: over.role ?? "USER",
    createdAt: over.createdAt ?? new Date("2024-01-01T00:00:00Z"),
    updatedAt: over.updatedAt ?? new Date("2024-01-01T00:00:00Z"),
  });

  it("list() returns mapped Users with pagination + filter metadata", async () => {
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

  it("list() forwards q as case-insensitive OR on email+name", async () => {
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

  it("findById returns null when no row matches", async () => {
    const { repo, user } = buildRepo();
    user.findUnique.mockResolvedValue(null);
    expect(await repo.findById("missing")).toBeNull();
  });

  it("findById maps a found row to a User", async () => {
    const { repo, user } = buildRepo();
    user.findUnique.mockResolvedValue(userRow({ id: "u1" }));
    const result = await repo.findById("u1");
    expect(result).toBeInstanceOf(User);
    expect(result?.id).toBe("u1");
  });

  it("findByEmail normalizes the email and returns the mapped User", async () => {
    const { repo, user } = buildRepo();
    user.findUnique.mockResolvedValue(userRow({ email: "a@a.com" }));
    const result = await repo.findByEmail("  A@A.COM ");
    expect(user.findUnique).toHaveBeenCalledWith({
      where: { email: "a@a.com" },
      select: expect.objectContaining({ id: true, email: true }),
    });
    expect(result?.email.value).toBe("a@a.com");
  });

  it("findByEmail returns null when nothing matches", async () => {
    const { repo, user } = buildRepo();
    user.findUnique.mockResolvedValue(null);
    expect(await repo.findByEmail("nope@nope.com")).toBeNull();
  });

  it("update() with both fields sends both in the data payload", async () => {
    const { repo, user } = buildRepo();
    user.update.mockResolvedValue(
      userRow({ name: "Alice2", email: "a2@a.com", updatedAt: new Date() }),
    );
    const result = await repo.update("u1", {
      name: "Alice2",
      email: "a2@a.com",
    });
    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: { name: "Alice2", email: "a2@a.com" },
      }),
    );
    expect(result).toBeInstanceOf(User);
    expect(result.name.value).toBe("Alice2");
  });

  it("update() with only name omits email from data", async () => {
    const { repo, user } = buildRepo();
    user.update.mockResolvedValue(userRow({ name: "Only" }));
    await repo.update("u1", { name: "Only" });
    const call = user.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(call.data).toEqual({ name: "Only" });
    expect("email" in call.data).toBe(false);
  });

  it("update() with only email omits name from data", async () => {
    const { repo, user } = buildRepo();
    user.update.mockResolvedValue(userRow({ email: "new@a.com" }));
    await repo.update("u1", { email: "new@a.com" });
    const call = user.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(call.data).toEqual({ email: "new@a.com" });
    expect("name" in call.data).toBe(false);
  });

  it("delete() forwards the id to prisma.user.delete", async () => {
    const { repo, user } = buildRepo();
    user.delete.mockResolvedValue(undefined);
    await repo.delete("u1");
    expect(user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
  });
});
