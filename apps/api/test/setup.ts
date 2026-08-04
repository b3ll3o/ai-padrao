import 'reflect-metadata';
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://ai_padrao:ai_padrao_dev@localhost:5432/ai_padrao';