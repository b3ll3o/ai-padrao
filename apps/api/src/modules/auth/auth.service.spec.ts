import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock }; refreshToken: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock } };

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
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) => ({ JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32), JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '7d' }[k]),
            getOrThrow: (k: string) => {
              const v = { JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32), JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '7d' }[k];
              if (v === undefined) throw new Error(`Missing config: ${k}`);
              return v;
            },
          },
        },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('signed.jwt.token'), verifyAsync: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A', role: UserRole.USER });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({ email: 'a@b.c', password: 'StrongPass1!', name: 'A' });
      expect(result.user.email).toBe('a@b.c');
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
    });

    it('throws ConflictException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(service.register({ email: 'a@b.c', password: 'StrongPass1!', name: 'A' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const hash = await argon2.hash('StrongPass1!');
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A', role: UserRole.USER, passwordHash: hash });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: 'a@b.c', password: 'StrongPass1!' });
      expect(result.user.email).toBe('a@b.c');
    });

    it('throws UnauthorizedException for unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'a@b.c', password: 'StrongPass1!' })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await argon2.hash('StrongPass1!');
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A', role: UserRole.USER, passwordHash: hash });
      await expect(service.login({ email: 'a@b.c', password: 'WrongPass1!' })).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});