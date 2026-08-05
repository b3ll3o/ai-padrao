import { FakeAccessTokenIssuer } from "../testing/fake-access-token.issuer";
import { FakePasswordHasher } from "../testing/fake-password.hasher";
import { FakeRefreshTokenGenerator } from "../testing/fake-refresh-token.generator";
import { Sha256RefreshTokenHasher } from "../testing/fake-refresh-token.hasher";
import { InMemoryRefreshTokenStore } from "../testing/in-memory-refresh-token.store";
import { InMemoryUserAuthRepository } from "../testing/in-memory-user-auth.repository";
import { EmailAlreadyRegisteredError } from "../../domain/errors/email-already-registered.error";
import { RegisterUseCase } from "./register.use-case";

const CONFIG = { accessTtl: "15m", refreshTtlMs: 7 * 86_400_000 };

function build() {
  const users = new InMemoryUserAuthRepository();
  const hasher = new FakePasswordHasher();
  const issuer = new FakeAccessTokenIssuer();
  const generator = new FakeRefreshTokenGenerator();
  const tokenHasher = new Sha256RefreshTokenHasher();
  const store = new InMemoryRefreshTokenStore();
  return {
    users,
    store,
    issuer,
    useCase: new RegisterUseCase(
      users,
      hasher,
      issuer,
      generator,
      tokenHasher,
      store,
    ),
  };
}

describe("RegisterUseCase", () => {
  it("creates a user and issues tokens", async () => {
    const { useCase, users, issuer } = build();

    const result = await useCase.execute(
      { email: "alice@example.com", password: "StrongPass1!", name: "Alice" },
      CONFIG,
    );

    expect(result.user.email).toBe("alice@example.com");
    expect(result.accessToken).toMatch(/^fake\./);
    expect(issuer.lastPayload?.sub).toBeDefined();
    expect(await users.findByEmail("alice@example.com")).not.toBeNull();
  });

  it("throws EmailAlreadyRegisteredError when email already exists", async () => {
    const { useCase } = build();
    await useCase.execute(
      { email: "alice@example.com", password: "StrongPass1!", name: "Alice" },
      CONFIG,
    );
    await expect(
      useCase.execute(
        { email: "alice@example.com", password: "OtherPass1!", name: "Alice2" },
        CONFIG,
      ),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it("persists the refresh token hashed with sha256", async () => {
    const { useCase, store, issuer } = build();
    const result = await useCase.execute(
      { email: "alice@example.com", password: "StrongPass1!", name: "Alice" },
      CONFIG,
    );
    const stored = await store.findByHash(
      new Sha256RefreshTokenHasher().hash(result.refreshToken),
    );
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(issuer.lastTtl).toBe("15m");
  });
});
