// Nest DI + emitDecoratorMetadata need the runtime value here; `import type` erases it.

import { Injectable } from "@nestjs/common";
import type { HealthCheckPort } from "../../../domain/ports/health-check.port";
// Nest DI + emitDecoratorMetadata precisam do valor em tempo de execução aqui; `import type` o apaga.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../../../../infra/prisma/prisma.service";

// Mora em `infrastructure/persistence/prisma/` mesmo não persistindo uma
// Entity de domínio, para que a regra de direção de dependências
// (infraestrutura → ports de domínio) se mantenha sem exceções.

@Injectable()
/**
 * Adapter baseado em Prisma para a `HealthCheckPort`. Executa a ida e
 * volta mais barata possível ao banco (`SELECT 1`) para confirmar que o
 * banco está acessível a partir do container da api.
 *
 * @example
 *   const check = new PrismaDbHealthCheck(prisma);
 *   await check.ping(); // resolve no SELECT 1 ok; rejeita caso contrário
 *
 * @remarks
 *   Use `PrismaService` (o wrapper local), não `@prisma/client`
 *   diretamente. O PrismaService ativa a extension de audit e garante
 *   comportamento consistente do middleware em produção. Em testes
 *   unitários, um mock feito à mão com `{ $queryRaw: jest.fn() }` é
 *   suficiente — veja `prisma-db-health-check.spec.ts`.
 */
export class PrismaDbHealthCheck implements HealthCheckPort {
  constructor(private readonly prisma: PrismaService) {}

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
