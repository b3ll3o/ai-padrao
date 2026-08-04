import { RegisterInputSchema, LoginInputSchema, RefreshInputSchema, UserRoleSchema } from './auth';

describe('auth schemas', () => {
  describe('RegisterInputSchema', () => {
    it('accepts a valid registration', () => {
      const result = RegisterInputSchema.safeParse({
        email: 'user@example.com',
        password: 'StrongPass1!',
        name: 'Jane Doe',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = RegisterInputSchema.safeParse({
        email: 'not-an-email',
        password: 'StrongPass1!',
        name: 'Jane',
      });
      expect(result.success).toBe(false);
    });

    it('rejects weak password', () => {
      const result = RegisterInputSchema.safeParse({
        email: 'user@example.com',
        password: '123',
        name: 'Jane',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('LoginInputSchema', () => {
    it('accepts a valid login', () => {
      const result = LoginInputSchema.safeParse({
        email: 'user@example.com',
        password: 'StrongPass1!',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty password', () => {
      const result = LoginInputSchema.safeParse({
        email: 'user@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RefreshInputSchema', () => {
    it('accepts a refresh token string', () => {
      const result = RefreshInputSchema.safeParse({ refreshToken: 'any.jwt.string' });
      expect(result.success).toBe(true);
    });

    it('rejects empty token', () => {
      const result = RefreshInputSchema.safeParse({ refreshToken: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('UserRoleSchema', () => {
    it('accepts ADMIN and USER', () => {
      expect(UserRoleSchema.safeParse('ADMIN').success).toBe(true);
      expect(UserRoleSchema.safeParse('USER').success).toBe(true);
    });

    it('rejects unknown roles', () => {
      expect(UserRoleSchema.safeParse('GUEST').success).toBe(false);
    });
  });
});