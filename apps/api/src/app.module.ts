import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./infra/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersContextModule } from "./contexts/users/users-context.module";
import { HealthModule } from "./modules/health/health.module";
import { envSchema } from "./infra/config/env.schema";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: envSchema.parse }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    UsersContextModule,
    HealthModule,
  ],
})
export class AppModule {}
