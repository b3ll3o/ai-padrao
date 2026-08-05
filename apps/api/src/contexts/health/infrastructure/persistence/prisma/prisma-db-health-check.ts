// Nest DI + emitDecoratorMetadata need the runtime value here; `import type` erases it.

import { Injectable } from "@nestjs/common";
import type { HealthCheckPort } from "../../../domain/ports/health-check.port";
// Nest DI + emitDecoratorMetadata need the runtime value here; `import type` erases it.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../../../../infra/prisma/prisma.service";

// Lives in `infrastructure/persistence/prisma/` even though it does
// not persist a domain entity, so the dependency-direction rule
// (infrastructure → domain ports) holds without exceptions.

@Injectable()
/**
 * Prisma-backed adapter for the `HealthCheckPort`. Runs the cheapest
 * possible DB round-trip (`SELECT 1`) to confirm the database is
 * reachable from the api container.
 *
 * @example
 *   const check = new PrismaDbHealthCheck(prisma);
 *   await check.ping(); // resolves on SELECT 1 ok; rejects otherwise
 *
 * @remarks
 *   Use `PrismaService` (the local wrapper), not `@prisma/client`
 *   directly. PrismaService activates the audit extension and
 *   guarantees consistent middleware behaviour in production. In
 *   unit tests, a hand-rolled mock with `{ $queryRaw: jest.fn() }`
 *   is enough — see `prisma-db-health-check.spec.ts`.
 */
export class PrismaDbHealthCheck implements HealthCheckPort {
  constructor(private readonly prisma: PrismaService) {}

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
