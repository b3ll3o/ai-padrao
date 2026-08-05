import { HealthHttpController } from "./health-http.controller";
import type { HealthCheckPort } from "../../domain/ports/health-check.port";

describe("HealthHttpController", () => {
  const build = () => {
    const ping = jest.fn();
    const port = { ping } as unknown as HealthCheckPort & { ping: jest.Mock };
    const controller = new HealthHttpController(port);
    return { controller, ping };
  };

  it("liveness returns ok + process uptime (number)", () => {
    const { controller } = build();
    const result = controller.liveness();
    expect(result.status).toBe("ok");
    expect(typeof result.uptime).toBe("number");
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it("readiness returns ok when the health check port resolves", async () => {
    const { controller, ping } = build();
    ping.mockResolvedValue(undefined);
    const result = await controller.readiness();
    expect(result).toEqual({ status: "ok", db: "up" });
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it("readiness returns error when the health check port throws", async () => {
    const { controller, ping } = build();
    ping.mockRejectedValue(new Error("db-down"));
    const result = await controller.readiness();
    expect(result).toEqual({ status: "error", db: "down" });
  });

  it("readiness returns error when the health check port rejects with a non-Error", async () => {
    const { controller, ping } = build();
    ping.mockRejectedValue("connection refused");
    const result = await controller.readiness();
    expect(result).toEqual({ status: "error", db: "down" });
  });

  it("readiness swallows the underlying error — never leaks it to the wire", async () => {
    const { controller, ping } = build();
    const sensitive = new Error(
      "postgres://user:secret@host:5432/db connection refused",
    );
    ping.mockRejectedValue(sensitive);
    const result = await controller.readiness();
    expect(result).toEqual({ status: "error", db: "down" });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("postgres://");
  });
});
