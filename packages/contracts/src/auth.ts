import { z } from 'zod';

export const UserRoleSchema = z.enum(['ADMIN', 'USER']);
export type UserRole = z.infer<typeof UserRoleSchema>;

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a digit');

export const RegisterInputSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1).max(120),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RefreshInputSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshInputSchema>;