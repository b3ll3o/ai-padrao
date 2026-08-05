import { JwtStrategy } from "./jwt.strategy";

describe("JwtStrategy.validate", () => {
  const strategy = Object.create(JwtStrategy.prototype) as JwtStrategy;

  it("projects {sub, email, role} onto {id, email, role}", async () => {
    const result = await strategy.validate({
      sub: "user-123",
      email: "alice@example.com",
      role: "ADMIN",
    });
    expect(result).toEqual({
      id: "user-123",
      email: "alice@example.com",
      role: "ADMIN",
    });
  });

  it("preserves USER role passthrough", async () => {
    const result = await strategy.validate({
      sub: "user-456",
      email: "bob@example.com",
      role: "USER",
    });
    expect(result).toEqual({
      id: "user-456",
      email: "bob@example.com",
      role: "USER",
    });
  });

  it("returns a plain object (not wrapped)", async () => {
    const result = (await strategy.validate({
      sub: "x",
      email: "x@x",
      role: "USER",
    })) as unknown;
    expect(typeof result).toBe("object");
    expect(Array.isArray(result)).toBe(false);
  });
});
