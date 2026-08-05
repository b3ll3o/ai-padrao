import { HealthController } from "./health.controller";
import type { PrismaService } from "../../infra/prisma/prisma.service";

describe("HealthController", () => {
  const build = () => {
    const $queryRaw = jest.fn();
    const prisma = { $queryRaw } as unknown as PrismaService & {
      $queryRaw: jest.Mock;
    };
    const controller = new HealthController(prisma as unknown as PrismaService);
    return { controller, $queryRaw };
  };

  it("liveness returns ok + process uptime (number)", () => {
    const { controller } = build();
    const result = controller.liveness();
    expect(result.status).toBe("ok");
    expect(typeof result.uptime).toBe("number");
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it("readiness returns ok when DB SELECT 1 succeeds", async () => {
    const { controller, $queryRaw } = build();
    $queryRaw.mockResolvedValue(1);
    const result = await controller.readiness();
    expect(result).toEqual({ status: "ok", db: "up" });
    expect($queryRaw).toHaveBeenCalledTimes(1);
  });

  it("readiness returns error when DB SELECT 1 throws", async () => {
    const { controller, $queryRaw } = build();
    $queryRaw.mockRejectedValue(new Error("db-down"));
    const result = await controller.readiness();
    expect(result).toEqual({ status: "error", db: "down" });
  });

  it("readiness returns error when DB SELECT 1 returns a rejected promise", async () => {
    const { controller, $queryRaw } = build();
    $queryRaw.mockRejectedValue("connection refused");
    const result = await controller.readiness();
    expect(result).toEqual({ status: "error", db: "down" });
  });
});
