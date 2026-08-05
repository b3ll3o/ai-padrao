import { JwtAccessTokenIssuer } from "./jwt-access-token.issuer";
import type { JwtService } from "@nestjs/jwt";

describe("JwtAccessTokenIssuer", () => {
  const jwt = {
    signAsync: jest.fn(),
  } as unknown as JwtService & { signAsync: jest.Mock };
  const config = { accessSecret: "test-secret" };
  const issuer = new JwtAccessTokenIssuer(jwt as JwtService, config);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("signs payloads via Nest JwtService with configured secret and TTL string", async () => {
    (jwt.signAsync as jest.Mock).mockResolvedValue("signed-jwt");
    const payload = { sub: "user-1", email: "a@b.com", role: "USER" };

    const token = await issuer.sign(payload, "15m");

    expect(jwt.signAsync).toHaveBeenCalledWith(payload, {
      secret: "test-secret",
      expiresIn: "15m",
    });
    expect(token).toBe("signed-jwt");
  });

  it("forwards arbitrary TTL strings unchanged", async () => {
    (jwt.signAsync as jest.Mock).mockResolvedValue("other-jwt");
    await issuer.sign({ sub: "u", email: "e", role: "ADMIN" }, "7d");
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: "u", email: "e", role: "ADMIN" },
      { secret: "test-secret", expiresIn: "7d" },
    );
  });

  it("propagates signAsync rejection as a failure", async () => {
    (jwt.signAsync as jest.Mock).mockRejectedValue(new Error("boom"));
    await expect(
      issuer.sign({ sub: "u", email: "e", role: "USER" }, "1h"),
    ).rejects.toThrow("boom");
  });
});
