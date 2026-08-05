import { RandomRefreshTokenGenerator } from "./random-refresh-token.generator";

describe("RandomRefreshTokenGenerator", () => {
  const generator = new RandomRefreshTokenGenerator();

  it("returns a base64url string without padding", () => {
    const token = generator.generate();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    expect(token).not.toMatch(/=+$/);
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  it("produces 64 base64url characters (48 bytes encoded)", () => {
    const token = generator.generate();
    expect(token).toHaveLength(64);
  });

  it("generates a fresh value on each call (no caching)", () => {
    const a = generator.generate();
    const b = generator.generate();
    expect(a).not.toBe(b);
  });
});
