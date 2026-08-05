import { Sha256RefreshTokenHasher } from "../testing/fake-refresh-token.hasher";
import { InMemoryRefreshTokenStore } from "../testing/in-memory-refresh-token.store";
import { LogoutUseCase } from "./logout.use-case";

const tokenHasher = new Sha256RefreshTokenHasher();

describe("LogoutUseCase", () => {
  it("revokes the matching active refresh token", async () => {
    const store = new InMemoryRefreshTokenStore();
    await store.persist({
      userId: "u1",
      tokenHash: tokenHasher.hash("to-revoke"),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const useCase = new LogoutUseCase(tokenHasher, store);

    await useCase.execute({ refreshToken: "to-revoke" });

    const record = await store.findByHash(tokenHasher.hash("to-revoke"));
    expect(record?.revokedAt).not.toBeNull();
  });

  it("is a no-op when no active refresh token matches", async () => {
    const store = new InMemoryRefreshTokenStore();
    const useCase = new LogoutUseCase(tokenHasher, store);

    await expect(
      useCase.execute({ refreshToken: "unknown" }),
    ).resolves.toBeUndefined();
  });
});
