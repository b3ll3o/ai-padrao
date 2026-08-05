import { FakeAccessTokenIssuer } from "../testing/fake-access-token.issuer";
import { FakeRefreshTokenGenerator } from "../testing/fake-refresh-token.generator";
import { Sha256RefreshTokenHasher } from "../testing/fake-refresh-token.hasher";
import { InMemoryRefreshTokenStore } from "../testing/in-memory-refresh-token.store";
import { InMemoryUserAuthRepository } from "../testing/in-memory-user-auth.repository";
import { InvalidCredentialsError } from "../../domain/errors/invalid-credentials.error";
import { RefreshUseCase } from "./refresh.use-case";

const CONFIG = { accessTtl: "15m", refreshTtlMs: 7 * 86_400_000 };

function build() {
  const users = new InMemoryUserAuthRepository();
  const issuer = new FakeAccessTokenIssuer();
  const generator = new FakeRefreshTokenGenerator();
  const tokenHasher = new Sha256RefreshTokenHasher();
  const store = new InMemoryRefreshTokenStore();
  return {
    users,
    issuer,
    generator,
    tokenHasher,
    store,
    useCase: new RefreshUseCase(users, issuer, generator, tokenHasher, store),
  };
}

async function seedActiveToken(store: InMemoryRefreshTokenStore) {
  const tokenHash = new Sha256RefreshTokenHasher().hash("active-token");
  await store.persist({
    userId: "u1",
    tokenHash,
    expiresAt: new Date(Date.now() + 60_000),
  });
  return { tokenHash, recordId: (await store.findByHash(tokenHash))!.id };
}

describe("RefreshUseCase", () => {
  it("rotates a valid refresh token and issues a new pair", async () => {
    const { useCase, users, store } = build();
    const { recordId } = await seedActiveToken(store);
    users.seed({
      id: "u1",
      email: "alice@example.com",
      name: "Alice",
      role: "USER",
      passwordHash: "fake:hash",
    });
    const stored = await store.findByHash(
      new Sha256RefreshTokenHasher().hash("active-token"),
    );
    expect(stored?.userId).toBe("u1");
    expect(recordId).toBeDefined();

    const result = await useCase.execute(
      { refreshToken: "active-token" },
      CONFIG,
    );

    expect(result.user.email).toBe("alice@example.com");
    expect(result.refreshToken).not.toBe("active-token");
    const after = await store.findByHash(
      new Sha256RefreshTokenHasher().hash("active-token"),
    );
    expect(after?.revokedAt).not.toBeNull();
  });

  it("throws InvalidCredentialsError when the token is unknown", async () => {
    const { useCase } = build();
    await expect(
      useCase.execute({ refreshToken: "missing" }, CONFIG),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("throws InvalidCredentialsError when the token is revoked", async () => {
    const { useCase, store } = build();
    const tokenHash = new Sha256RefreshTokenHasher().hash("revoked");
    await store.persist({
      userId: "u1",
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await store.revokeActiveByHash(tokenHash);
    await expect(
      useCase.execute({ refreshToken: "revoked" }, CONFIG),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("throws InvalidCredentialsError when the token is expired", async () => {
    const { useCase, store } = build();
    const tokenHash = new Sha256RefreshTokenHasher().hash("expired");
    await store.persist({
      userId: "u1",
      tokenHash,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(
      useCase.execute({ refreshToken: "expired" }, CONFIG),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("throws InvalidCredentialsError when the user no longer exists", async () => {
    const { useCase, store } = build();
    await store.persist({
      userId: "ghost",
      tokenHash: new Sha256RefreshTokenHasher().hash("orphan"),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(
      useCase.execute({ refreshToken: "orphan" }, CONFIG),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
