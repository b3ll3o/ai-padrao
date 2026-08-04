import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://otel-collector:4318'),
  OTEL_SERVICE_NAME: z.string().default('ai-padrao-api'),
  SMTP_HOST: z.string().default('mailhog'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().default('no-reply@ai-padrao.local'),
});

export type Env = z.infer<typeof envSchema>;