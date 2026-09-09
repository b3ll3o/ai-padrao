// Nest DI + emitDecoratorMetadata need the runtime value here; `import type` erases it.

import { Module } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { HealthHttpController } from "./infrastructure/http/health-http.controller";
import { PrismaDbHealthCheck } from "./infrastructure/persistence/prisma/prisma-db-health-check";
import { HEALTH_CHECK_PORT } from "./health-context.tokens";

// No `application/use-cases/` folder is created on purpose — the
// pragmatic-DDD rule (`apps/api/AGENTS.md` §"Required architecture")
// forbids adding abstractions that only rename framework or database
// operations. Health is infrastructure-only and stays under
// `infrastructure/`. See `README.md` for the rationale.

@Module({
 controllers: [HealthHttpController],
 providers: [
 {
 provide: PrismaDbHealthCheck,
 inject: [PrismaService],
 useFactory: (prisma: PrismaService) => new PrismaDbHealthCheck(prisma),
 },
 {
 provide: HEALTH_CHECK_PORT,
 useExisting: PrismaDbHealthCheck,
 },
 ],
})
/**
 * Composition root for the health bounded context. The liveness probe
 * has no dependencies; the readiness probe delegates to the
 * `HealthCheckPort`, which the Prisma adapter satisfies in production.
 * Tests inject fakes by binding a different value to `HEALTH_CHECK_PORT`.
 *
 * @example
 * // Production wiring — Prisma is the only dependency:
 * HealthContextModule;
 *
 * @remarks
 * The `useFactory` + `useExisting` pattern (instead of `useClass`)
 * sidesteps the ADR-002 metadata issue: Nest reads
 * `design:paramtypes` at decoration time and `import type` would
 * erase it. Keep both providers here whenever a new port is added.
 */
export class HealthContextModule {}
