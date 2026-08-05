import { FakeAccessTokenIssuer } from "../testing/fake-access-token.issuer";
import { FakePasswordHasher } from "../testing/fake-password.hasher";
import { FakeRefreshTokenGenerator } from "../testing/fake-refresh-token.generator";
import { Sha256RefreshTokenHasher } from "../testing/fake-refresh-token.hasher";
import { InMemoryRefreshTokenStore } from "../testing/in-memory-refresh-token.store";
import { InMemoryUserAuthRepository } from "../testing/in-memory-user-auth.repository";
import { InvalidCredentialsError } from "../../domain/errors/invalid-credentials.error";
import { LoginUseCase } from "./login.use-case";

const CONFIG = { accessTtl: "15m", refreshTtlMs: 7 * 86_400_000 };

async function seedUser() {
  const hasher = new FakePasswordHasher();
  const users = new InMemoryUserAuthRepository();
  const passwordHash = await hasher.hash("StrongPass1!");
  const created = await users.create({
    email: "alice@example.com",
    name: "Alice",
    passwordHash,
  });
  return { hasher, users, created };
}

function buildDeps(seed?: Awaited<ReturnType<typeof seedUser>>) {
  const issuer = new FakeAccessTokenIssuer();
  const generator = new FakeRefreshTokenGenerator();
  const tokenHasher = new Sha256RefreshTokenHasher();
  const store = new InMemoryRefreshTokenStore();
  const hasher = seed?.hasher ?? new FakePasswordHasher();
  const users = seed?.users ?? new InMemoryUserAuthRepository();
  const useCase = new LoginUseCase(
    users,
    hasher,
    issuer,
    generator,
    tokenHasher,
    store,
  );
  return { useCase, issuer };
}

describe("LoginUseCase", () => {
  it("issues tokens for valid credentials", async () => {
    const seed = await seedUser();
    const { useCase, issuer } = buildDeps(seed);

    const result = await useCase.execute(
      { email: "alice@example.com", password: "StrongPass1!" },
      CONFIG,
    );

    expect(result.user.email).toBe("alice@example.com");
    expect(result.accessToken).toMatch(/^fake\./);
    expect(issuer.lastPayload?.email).toBe("alice@example.com");
  });

  it("throws InvalidCredentialsError for unknown email", async () => {
    const { useCase } = buildDeps();
    await expect(
      useCase.execute(
        { email: "nobody@example.com", password: "StrongPass1!" },
        CONFIG,
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("throws InvalidCredentialsError for wrong password", async () => {
    const seed = await seedUser();
    const { useCase } = buildDeps(seed);
    await expect(
      useCase.execute(
        { email: "alice@example.com", password: "WrongPass1!" },
        CONFIG,
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
