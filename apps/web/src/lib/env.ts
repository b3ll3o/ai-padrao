import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  API_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  API_URL: process.env.API_URL ?? 'http://api:3001',
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
});
