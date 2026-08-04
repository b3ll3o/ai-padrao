import { UserDtoSchema, UpdateUserInputSchema, UserListQuerySchema } from './users';

describe('users schemas', () => {
  const validUser = {
    id: 'clxxxxxxxxxxxxxxxxxxxxxx',
    email: 'user@example.com',
    name: 'Jane Doe',
    role: 'USER' as const,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  };

  describe('UserDtoSchema', () => {
    it('accepts a valid user DTO', () => {
      const result = UserDtoSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    it('rejects missing fields', () => {
      const result = UserDtoSchema.safeParse({ id: '1', email: 'a@b.c' });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateUserInputSchema', () => {
    it('accepts partial updates', () => {
      const result = UpdateUserInputSchema.safeParse({ name: 'New Name' });
      expect(result.success).toBe(true);
    });

    it('rejects empty object', () => {
      const result = UpdateUserInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('UserListQuerySchema', () => {
    it('applies defaults', () => {
      const result = UserListQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('coerces string page numbers', () => {
      const result = UserListQuerySchema.parse({ page: '3', pageSize: '50' });
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(50);
    });

    it('rejects negative pages', () => {
      const result = UserListQuerySchema.safeParse({ page: -1 });
      expect(result.success).toBe(false);
    });
  });
});