import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash } from "node:crypto";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { UserRole } from "@prisma/client";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              ({
                JWT_ACCESS_SECRET: "a".repeat(32),
                JWT_REFRESH_SECRET: "b".repeat(32),
                JWT_ACCESS_TTL: "15m",
                JWT_REFRESH_TTL: "7d",
              })[k],
            getOrThrow: (k: string) => {
              const v = {
                JWT_ACCESS_SECRET: "a".repeat(32),
                JWT_REFRESH_SECRET: "b".repeat(32),
                JWT_ACCESS_TTL: "15m",
                JWT_REFRESH_TTL: "7d",
              }[k];
              if (v === undefined) throw new Error(`Missing config: ${k}`);
              return v;
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue("signed.jwt.token"),
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  const futureDate = (ms: number) => new Date(Date.now() + ms);

  const hashOf = (token: string) =>
    createHash("sha256").update(token).digest("hex");

  describe("register", () => {
    it("creates a user and returns tokens", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: "u1",
        email: "a@b.c",
        name: "A",
        role: UserRole.USER,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        email: "a@b.c",
        password: "StrongPass1!",
        name: "A",
      });
      expect(result.user.email).toBe("a@b.c");
      expect(result.accessToken).toBe("signed.jwt.token");
      expect(typeof result.refreshToken).toBe("string");
      expect(result.refreshToken.length).toBeGreaterThan(0);
    });

    it("throws ConflictException if email already exists", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1" });
      await expect(
        service.register({
          email: "a@b.c",
          password: "StrongPass1!",
          name: "A",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("persists a refresh-token row hashed with sha256", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: "u1",
        email: "a@b.c",
        name: "A",
        role: UserRole.USER,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      await service.register({
        email: "a@b.c",
        password: "StrongPass1!",
        name: "A",
      });

      const createArg = prisma.refreshToken.create.mock.calls[0][0];
      expect(createArg.data.userId).toBe("u1");
      expect(createArg.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(createArg.data.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe("login", () => {
    it("returns tokens for valid credentials", async () => {
      const hash = await argon2.hash("StrongPass1!");
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "a@b.c",
        name: "A",
        role: UserRole.USER,
        passwordHash: hash,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: "a@b.c",
        password: "StrongPass1!",
      });
      expect(result.user.email).toBe("a@b.c");
    });

    it("throws UnauthorizedException for unknown email", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: "a@b.c", password: "StrongPass1!" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("throws UnauthorizedException for wrong password", async () => {
      const hash = await argon2.hash("StrongPass1!");
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "a@b.c",
        name: "A",
        role: UserRole.USER,
        passwordHash: hash,
      });
      await expect(
        service.login({ email: "a@b.c", password: "WrongPass1!" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("refresh", () => {
    it("rotates a valid refresh token and issues a new pair", async () => {
      const oldToken = "old-refresh-token";
      const tokenHash = hashOf(oldToken);
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt1",
        tokenHash,
        revokedAt: null,
        expiresAt: futureDate(60_000),
        user: { id: "u1", email: "a@b.c", name: "A", role: UserRole.USER },
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh({ refreshToken: oldToken });

      expect(result.user.email).toBe("a@b.c");
      expect(result.accessToken).toBe("signed.jwt.token");
      expect(result.refreshToken).not.toBe(oldToken);
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt1" },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("throws UnauthorizedException when the token is unknown", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(
        service.refresh({ refreshToken: "missing" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("throws UnauthorizedException when the token is already revoked", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt1",
        tokenHash: hashOf("revoked"),
        revokedAt: new Date(),
        expiresAt: futureDate(60_000),
        user: { id: "u1", email: "a@b.c", name: "A", role: UserRole.USER },
      });
      await expect(
        service.refresh({ refreshToken: "revoked" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("throws UnauthorizedException when the token is expired", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt1",
        tokenHash: hashOf("expired"),
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        user: { id: "u1", email: "a@b.c", name: "A", role: UserRole.USER },
      });
      await expect(
        service.refresh({ refreshToken: "expired" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("logout", () => {
    it("revokes the matching active refresh token", async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout({ refreshToken: "to-revoke" });

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: hashOf("to-revoke"), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("is a no-op when no active refresh token matches", async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.logout({ refreshToken: "unknown" }),
      ).resolves.toBeUndefined();
    });
  });
});
