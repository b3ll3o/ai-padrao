import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { UserRole } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock; count: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
  });

  describe('list', () => {
    it('returns paginated users', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, pageSize: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });

  describe('findOne', () => {
    it('returns a user by id', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A', role: UserRole.USER, createdAt: new Date(), updatedAt: new Date() });
      const result = await service.findOne('u1');
      expect(result.id).toBe('u1');
    });

    it('throws NotFoundException if missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne('u1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates name and returns updated user', async () => {
      prisma.user.update.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'New', role: UserRole.USER, createdAt: new Date(), updatedAt: new Date() });
      const result = await service.update('u1', { name: 'New' });
      expect(result.name).toBe('New');
    });
  });

  describe('remove', () => {
    it('deletes a user', async () => {
      prisma.user.delete.mockResolvedValue({});
      await expect(service.remove('u1')).resolves.toBeUndefined();
    });
  });
});
