import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { AuthHttpController } from "./auth-http.controller";
import { FakeAccessTokenIssuer } from "../../application/testing/fake-access-token.issuer";
import { FakePasswordHasher } from "../../application/testing/fake-password.hasher";
import { FakeRefreshTokenGenerator } from "../../application/testing/fake-refresh-token.generator";
import { Sha256RefreshTokenHasher } from "../../application/testing/fake-refresh-token.hasher";
import { InMemoryRefreshTokenStore } from "../../application/testing/in-memory-refresh-token.store";
import { InMemoryUserAuthRepository } from "../../application/testing/in-memory-user-auth.repository";
import { LoginUseCase } from "../../application/use-cases/login.use-case";
import { LogoutUseCase } from "../../application/use-cases/logout.use-case";
import { RefreshUseCase } from "../../application/use-cases/refresh.use-case";
import { RegisterUseCase } from "../../application/use-cases/register.use-case";

const CONFIG = { accessTtl: "15m", refreshTtlMs: 7 * 86_400_000 };

function buildController() {
  const users = new InMemoryUserAuthRepository();
  const hasher = new FakePasswordHasher();
  const issuer = new FakeAccessTokenIssuer();
  const generator = new FakeRefreshTokenGenerator();
  const tokenHasher = new Sha256RefreshTokenHasher();
  const store = new InMemoryRefreshTokenStore();

  const register = new RegisterUseCase(
    users,
    hasher,
    issuer,
    generator,
    tokenHasher,
    store,
  );
  const login = new LoginUseCase(
    users,
    hasher,
    issuer,
    generator,
    tokenHasher,
    store,
  );
  const refresh = new RefreshUseCase(
    users,
    issuer,
    generator,
    tokenHasher,
    store,
  );
  const logout = new LogoutUseCase(tokenHasher, store);

  const controller = new AuthHttpController(
    register,
    login,
    refresh,
    logout,
    CONFIG,
  );
  return { controller, users, hasher, store, tokenHasher };
}

describe("AuthHttpController", () => {
  describe("register", () => {
    it("returns tokens for a new user", async () => {
      const { controller } = buildController();
      const result = await controller.register({
        email: "alice@example.com",
        password: "StrongPass1!",
        name: "Alice",
      });
      expect(result.user.email).toBe("alice@example.com");
      expect(result.accessToken).toBeDefined();
    });

    it("throws ConflictException when email is already taken", async () => {
      const { controller } = buildController();
      await controller.register({
        email: "alice@example.com",
        password: "StrongPass1!",
        name: "Alice",
      });
      await expect(
        controller.register({
          email: "alice@example.com",
          password: "OtherPass1!",
          name: "Alice2",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("login", () => {
    it("returns tokens for valid credentials", async () => {
      const { controller, users, hasher } = buildController();
      const passwordHash = await hasher.hash("StrongPass1!");
      users.seed({
        id: "u1",
        email: "alice@example.com",
        name: "Alice",
        role: "USER",
        passwordHash,
      });
      const result = await controller.login({
        email: "alice@example.com",
        password: "StrongPass1!",
      });
      expect(result.user.id).toBe("u1");
    });

    it("throws UnauthorizedException for unknown email", async () => {
      const { controller } = buildController();
      await expect(
        controller.login({
          email: "nobody@example.com",
          password: "StrongPass1!",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("throws UnauthorizedException for wrong password", async () => {
      const { controller, users, hasher } = buildController();
      const passwordHash = await hasher.hash("StrongPass1!");
      users.seed({
        id: "u1",
        email: "alice@example.com",
        name: "Alice",
        role: "USER",
        passwordHash,
      });
      await expect(
        controller.login({
          email: "alice@example.com",
          password: "WrongPass1!",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("refresh", () => {
    it("rotates a valid refresh token", async () => {
      const { controller, users, store, tokenHasher } = buildController();
      users.seed({
        id: "u1",
        email: "alice@example.com",
        name: "Alice",
        role: "USER",
        passwordHash: "fake:hash",
      });
      await store.persist({
        userId: "u1",
        tokenHash: tokenHasher.hash("old-token"),
        expiresAt: new Date(Date.now() + 60_000),
      });
      const result = await controller.refresh({ refreshToken: "old-token" });
      expect(result.refreshToken).not.toBe("old-token");
    });

    it("throws UnauthorizedException for an invalid token", async () => {
      const { controller } = buildController();
      await expect(
        controller.refresh({ refreshToken: "missing" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("logout", () => {
    it("returns void and revokes the active token", async () => {
      const { controller, store, tokenHasher } = buildController();
      await store.persist({
        userId: "u1",
        tokenHash: tokenHasher.hash("to-revoke"),
        expiresAt: new Date(Date.now() + 60_000),
      });
      await expect(
        controller.logout({ refreshToken: "to-revoke" }),
      ).resolves.toBeUndefined();
      const record = await store.findByHash(tokenHasher.hash("to-revoke"));
      expect(record?.revokedAt).not.toBeNull();
    });

    it("is a no-op when no active token matches", async () => {
      const { controller } = buildController();
      await expect(
        controller.logout({ refreshToken: "unknown" }),
      ).resolves.toBeUndefined();
    });
  });
});
