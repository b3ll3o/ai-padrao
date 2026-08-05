import { PrismaUserAuthRepository } from "./prisma-user-auth.repository";
import type { PrismaService } from "../../../../../infra/prisma/prisma.service";

describe("PrismaUserAuthRepository", () => {
  const buildRepo = () => {
    const user = {
      create: jest.fn(),
      findUnique: jest.fn(),
    };
    const prisma = { user } as unknown as PrismaService & { user: typeof user };
    const repo = new PrismaUserAuthRepository(
      prisma as unknown as PrismaService,
    );
    return { repo, user, prisma };
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

  it("create forwards input fields and maps the created row", async () => {
    const { repo, user } = buildRepo();
    user.create.mockResolvedValue({
      id: "u3",
      email: "c@c.com",
      name: "Carol",
      role: "USER",
      passwordHash: "new-hash",
    });
    const result = await repo.create({
      email: "c@c.com",
      name: "Carol",
      passwordHash: "new-hash",
    });
    expect(user.create).toHaveBeenCalledWith({
      data: {
        email: "c@c.com",
        name: "Carol",
        passwordHash: "new-hash",
      },
    });
    expect(result.id).toBe("u3");
    expect(result.passwordHash).toBe("new-hash");
  });
});
