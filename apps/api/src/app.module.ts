import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./infra/prisma/prisma.module";
import { AuthContextModule } from "./contexts/auth/auth-context.module";
import { HealthContextModule } from "./contexts/health/health-context.module";
import { UsersContextModule } from "./contexts/users/users-context.module";
import { envSchema } from "./infra/config/env.schema";

/**
 * Composition root para a aplicação NestJS. Liga o config global
 * (validado contra `envSchema`), o throttler, o Prisma module e cada
 * bounded context sob `apps/api/src/contexts/`.
 *
 * A ordem não importa para o DI do Nest — os módulos são resolvidos
 * preguiçosamente — mas a ordem listada espelha a superfície pública
 * (auth → users → health) para que um leitor consiga mapear a API aos
 * bounded contexts sem fazer grep.
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
 * Composition root para a aplicação NestJS. Liga o config global
 * (validado contra `envSchema`), o throttler, o Prisma module e cada
 * bounded context sob `apps/api/src/contexts/`.
 *
 * A ordem não importa para o DI do Nest — os módulos são resolvidos
 * preguiçosamente — mas a ordem listada espelha a superfície pública
 * (auth → users → health) para que um leitor consiga mapear a API aos
 * bounded contexts sem fazer grep.
 *
 * @example
 *   // Bootstrap programático (usado em `main.ts`):
 *   const app = await NestFactory.create<NestFastifyApplication>(AppModule, ...);
 *
 * @remarks
 *   Os bounded contexts (`AuthContextModule`, `UsersContextModule`,
 *   `HealthContextModule`) são ligados aqui e reexportam seus Use Cases /
 *   Ports para que outros módulos possam consumi-los. Novos bounded
 *   contexts DEVEM ser adicionados a `imports` E (caso exponham Use
 *   Cases cross-context) à lista de reexports do módulo.
 */
export class AppModule {}
