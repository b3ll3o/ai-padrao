import { PrismaRefreshTokenStore } from "./prisma-refresh-token.store";
import type { PrismaService } from "../../../../../infra/prisma/prisma.service";

describe("PrismaRefreshTokenStore", () => {
  const buildStore = () => {
    const refreshToken = {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };
    const prisma = { refreshToken } as unknown as PrismaService & {
      refreshToken: typeof refreshToken;
    };
    const store = new PrismaRefreshTokenStore(
      prisma as unknown as PrismaService,
    );
    return { store, refreshToken };
  };

  it("findByHash retorna null quando não há linha", async () => {
    const { store, refreshToken } = buildStore();
    refreshToken.findUnique.mockResolvedValue(null);
    expect(await store.findByHash("no-such-hash")).toBeNull();
    expect(refreshToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: "no-such-hash" },
    });
  });

  it("findByHash mapeia uma linha para RefreshTokenRecord", async () => {
    const { store, refreshToken } = buildStore();
    const expiresAt = new Date("2030-01-01T00:00:00Z");
    refreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash-1",
      revokedAt: null,
      expiresAt,
    });
    const result = await store.findByHash("hash-1");
    expect(result).toEqual({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash-1",
      revokedAt: null,
      expiresAt,
    });
  });

  it("findByHash preserva o revokedAt de um registro revogado", async () => {
    const { store, refreshToken } = buildStore();
    const revokedAt = new Date("2025-06-01T00:00:00Z");
    refreshToken.findUnique.mockResolvedValue({
      id: "rt-2",
      userId: "user-1",
      tokenHash: "hash-2",
      revokedAt,
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    });
    const result = await store.findByHash("hash-2");
    expect(result?.revokedAt).toBe(revokedAt);
  });

  it("revoke define revokedAt como uma nova Date para o id correspondente", async () => {
    const { store, refreshToken } = buildStore();
    refreshToken.update.mockResolvedValue(undefined);
    const before = new Date();
    await store.revoke("rt-1");
    const after = new Date();
    expect(refreshToken.update).toHaveBeenCalledTimes(1);
    const call = refreshToken.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { revokedAt: Date };
    };
    expect(call.where).toEqual({ id: "rt-1" });
    expect(call.data.revokedAt).toBeInstanceOf(Date);
    expect(call.data.revokedAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
    expect(call.data.revokedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("revokeActiveByHash restringe o escopo a revokedAt:null apenas", async () => {
    const { store, refreshToken } = buildStore();
    refreshToken.updateMany.mockResolvedValue({ count: 1 });
    const before = new Date();
    await store.revokeActiveByHash("hash-1");
    const after = new Date();
    const call = refreshToken.updateMany.mock.calls[0]?.[0] as {
      where: { tokenHash: string; revokedAt: null };
      data: { revokedAt: Date };
    };
    expect(call.where).toEqual({ tokenHash: "hash-1", revokedAt: null });
    expect(call.data.revokedAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
    expect(call.data.revokedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("persist insere uma linha de refresh-token", async () => {
    const { store, refreshToken } = buildStore();
    refreshToken.create.mockResolvedValue(undefined);
    const expiresAt = new Date("2030-01-01T00:00:00Z");
    await store.persist({ userId: "user-2", tokenHash: "hash-2", expiresAt });
    expect(refreshToken.create).toHaveBeenCalledWith({
      data: {
        userId: "user-2",
        tokenHash: "hash-2",
        expiresAt,
      },
    });
  });
});
