import { PrismaService } from "./prisma.service";

describe("PrismaService lifecycle hooks", () => {
  const build = () => {
    const svc = Object.create(PrismaService.prototype) as PrismaService;
    const $connect = jest.fn().mockResolvedValue(undefined);
    const $disconnect = jest.fn().mockResolvedValue(undefined);
    (svc as unknown as { $connect: typeof $connect }).$connect = $connect;
    (svc as unknown as { $disconnect: typeof $disconnect }).$disconnect =
      $disconnect;
    return { svc, $connect, $disconnect };
  };

  it("onModuleInit calls $connect exactly once", async () => {
    const { svc, $connect } = build();
    await svc.onModuleInit();
    expect($connect).toHaveBeenCalledTimes(1);
  });

  it("onModuleDestroy calls $disconnect exactly once", async () => {
    const { svc, $disconnect } = build();
    await svc.onModuleDestroy();
    expect($disconnect).toHaveBeenCalledTimes(1);
  });

  it("propagates $connect rejection on init failure", async () => {
    const { svc, $connect } = build();
    $connect.mockRejectedValue(new Error("db-unreachable"));
    await expect(svc.onModuleInit()).rejects.toThrow("db-unreachable");
  });

  it("propagates $disconnect rejection on destroy failure", async () => {
    const { svc, $disconnect } = build();
    $disconnect.mockRejectedValue(new Error("db-disconnect-error"));
    await expect(svc.onModuleDestroy()).rejects.toThrow("db-disconnect-error");
  });

  it("does not call $disconnect during init or vice-versa", async () => {
    const { svc, $connect, $disconnect } = build();
    await svc.onModuleInit();
    expect($disconnect).not.toHaveBeenCalled();
    await svc.onModuleDestroy();
    expect($connect).toHaveBeenCalledTimes(1);
    expect($disconnect).toHaveBeenCalledTimes(1);
  });
});
