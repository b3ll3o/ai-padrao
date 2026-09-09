// Nest DI + emitDecoratorMetadata precisam do valor em tempo de execução aqui; `import type` o apaga.

import { Module } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { HealthHttpController } from "./infrastructure/http/health-http.controller";
import { PrismaDbHealthCheck } from "./infrastructure/persistence/prisma/prisma-db-health-check";
import { HEALTH_CHECK_PORT } from "./health-context.tokens";

// Nenhuma pasta `application/use-cases/` é criada de propósito — a regra
// de DDD pragmático (`apps/api/AGENTS.md` §"Required architecture")
// proíbe a adição de abstrações que apenas renomeiam operações de
// framework ou de banco. Health é exclusivamente de infraestrutura e
// permanece sob `infrastructure/`. Veja `README.md` para a justificativa.

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
 * Composition root do bounded context de health. O probe de liveness não
 * tem dependências; o probe de readiness delega para a `HealthCheckPort`,
 * que o Adapter do Prisma satisfaz em produção. Testes injetam fakes
 * vinculando um valor diferente a `HEALTH_CHECK_PORT`.
 *
 * @example
 * // Wiring de produção — Prisma é a única dependência:
 * HealthContextModule;
 *
 * @remarks
 * O padrão `useFactory` + `useExisting` (em vez de `useClass`) contorna
 * o problema de metadados do ADR-002: Nest lê `design:paramtypes` no
 * momento da decoração e `import type` o apagaria. Mantenha ambos os
 * providers aqui sempre que uma nova Port for adicionada.
 */
export class HealthContextModule {}
