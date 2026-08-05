import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./infra/prisma/prisma.module";
import { AuthContextModule } from "./contexts/auth/auth-context.module";
import { HealthContextModule } from "./contexts/health/health-context.module";
import { UsersContextModule } from "./contexts/users/users-context.module";
import { envSchema } from "./infra/config/env.schema";

/**
 * Composition root for the NestJS application. Wires the global config
 * (validated against `envSchema`), the throttler, the Prisma module, and
 * every bounded context under `apps/api/src/contexts/`.
 *
 * Order does not matter for Nest's DI — modules are resolved lazily — but
 * the listed order mirrors the public surface (auth → users → health) so
 * a reader can map the API to the bounded contexts without grepping.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: envSchema.parse }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    AuthContextModule,
    UsersContextModule,
    HealthContextModule,
  ],
})
/**
 * Composition root for the NestJS application. Wires the global config
 * (validated against `envSchema`), the throttler, the Prisma module, and
 * every bounded context under `apps/api/src/contexts/`.
 *
 * Order does not matter for Nest's DI — modules are resolved lazily — but
 * the listed order mirrors the public surface (auth → users → health) so
 * a reader can map the API to the bounded contexts without grepping.
 *
 * @example
 *   // Programmatic bootstrap (used in `main.ts`):
 *   const app = await NestFactory.create<NestFastifyApplication>(AppModule, ...);
 *
 * @remarks
 *   The bounded contexts (`AuthContextModule`, `UsersContextModule`,
 *   `HealthContextModule`) are wired here and re-export their use cases /
 *   ports so other modules can consume them. New bounded contexts MUST
 *   be added to `imports` AND (if they expose cross-context use cases)
 *   to the module's re-export list.
 */
export class AppModule {}
