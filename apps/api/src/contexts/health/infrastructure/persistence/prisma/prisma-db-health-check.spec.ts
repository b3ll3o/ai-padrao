import { PrismaDbHealthCheck } from "./prisma-db-health-check";
import type { PrismaService } from "../../../../../infra/prisma/prisma.service";

describe("PrismaDbHealthCheck", () => {
  const build = () => {
    const $queryRaw = jest.fn();
    const prisma = { $queryRaw } as unknown as PrismaService & {
      $queryRaw: jest.Mock;
    };
    const check = new PrismaDbHealthCheck(prisma as unknown as PrismaService);
    return { check, $queryRaw };
  };

  it("resolves when $queryRaw resolves", async () => {
    const { check, $queryRaw } = build();
    $queryRaw.mockResolvedValue(1);
    await expect(check.ping()).resolves.toBeUndefined();
    expect($queryRaw).toHaveBeenCalledTimes(1);
  });

  it("rejects when $queryRaw throws", async () => {
    const { check, $queryRaw } = build();
    $queryRaw.mockRejectedValue(new Error("db-down"));
    await expect(check.ping()).rejects.toThrow("db-down");
  });

  it("rejects when $queryRaw returns a rejected non-Error", async () => {
    const { check, $queryRaw } = build();
    $queryRaw.mockRejectedValue("connection refused");
    await expect(check.ping()).rejects.toBe("connection refused");
  });
});
