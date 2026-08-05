import { PrismaUserAuthRepository } from "./prisma-user-auth.repository";
import type { PrismaService } from "../../../../../infra/prisma/prisma.service";

describe("PrismaUserAuthRepository", () => {
  const buildRepo = () => {
    // Outer accessors — never called by `create()` since the
    // production code routes writes through $transaction.
    const user = {
      create: jest.fn(),
      findUnique: jest.fn(),
    };
    // Inner transaction client — has the SAME shape; production code
    // does `tx.user.create(...)` / `tx.userHistory.create(...)`.
    const txUser = {
      create: jest.fn(),
    };
    const txUserHistory = { create: jest.fn() };
    const tx = { user: txUser, userHistory: txUserHistory };

    const prisma = {
      user,
       
      $transaction: jest.fn(async (cb: any) => cb(tx)) as any,
    } as unknown as PrismaService;

    const repo = new PrismaUserAuthRepository(prisma);
    return { repo, user, txUser, txUserHistory, tx, prisma };
  };

  it("findByEmail trims+lowercases before querying and maps to record", async () => {
    const { repo, user } = buildRepo();
    user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "Alice",
      role: "USER",
      passwordHash: "argonhash",
    });
    const result = await repo.findByEmail("  A@B.COM  ");
    expect(user.findUnique).toHaveBeenCalledWith({
      where: { email: "a@b.com" },
    });
    expect(result).toEqual({
      id: "u1",
      email: "a@b.com",
      name: "Alice",
      role: "USER",
      passwordHash: "argonhash",
    });
  });

  it("findByEmail returns null when prisma returns null", async () => {
    const { repo, user } = buildRepo();
    user.findUnique.mockResolvedValue(null);
    expect(await repo.findByEmail("missing@example.com")).toBeNull();
  });

  it("findById maps a row by id to a record", async () => {
    const { repo, user } = buildRepo();
    user.findUnique.mockResolvedValue({
      id: "u2",
      email: "b@b.com",
      name: "Bob",
      role: "ADMIN",
      passwordHash: "h",
    });
    const result = await repo.findById("u2");
    expect(user.findUnique).toHaveBeenCalledWith({ where: { id: "u2" } });
    expect(result).toEqual({
      id: "u2",
      email: "b@b.com",
      name: "Bob",
      role: "ADMIN",
      passwordHash: "h",
    });
  });

  it("findById returns null when prisma returns null", async () => {
    const { repo, user } = buildRepo();
    user.findUnique.mockResolvedValue(null);
    expect(await repo.findById("missing")).toBeNull();
  });

  it("create forwards input fields, runs in $transaction and writes CREATE history", async () => {
    const { repo, txUser, txUserHistory, prisma } = buildRepo();
    txUser.create.mockResolvedValue({
      id: "u3",
      email: "c@c.com",
      name: "Carol",
      role: "USER",
      passwordHash: "new-hash",
      version: 0,
    });
    txUserHistory.create.mockResolvedValue({});

    const result = await repo.create({
      email: "c@c.com",
      name: "Carol",
      passwordHash: "new-hash",
    });

     
    expect((prisma as any).$transaction).toHaveBeenCalledTimes(1);
    expect(txUser.create).toHaveBeenCalledWith({
      data: {
        email: "c@c.com",
        name: "Carol",
        passwordHash: "new-hash",
      },
    });
    expect(txUserHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        originalId: "u3",
        version: 0,
        operation: "CREATE",
        changedAt: expect.any(Date),
        changedBy: null,
      }),
    });
    expect(result.id).toBe("u3");
    expect(result.passwordHash).toBe("new-hash");
  });
});
