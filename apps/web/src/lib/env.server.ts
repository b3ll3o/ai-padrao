import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
  API_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
});

export const env = envSchema.parse({
  API_URL: process.env.API_URL ?? 'http://api:3001',
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
});
