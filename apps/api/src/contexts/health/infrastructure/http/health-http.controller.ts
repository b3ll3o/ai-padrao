// Nest DI precisa do valor em tempo de execução aqui; `import type` o apaga de design:paramtypes.

import { Inject } from "@nestjs/common";
import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../../../common/decorators/public.decorator";
import { HEALTH_CHECK_PORT } from "../../health-context.tokens";
import type { HealthCheckPort } from "../../domain/ports/health-check.port";

@ApiTags("health")
@Public()
@Controller("health")
/**
 * Adapter HTTP para o bounded context de health. Expõe os dois probes do
 * orchestrator (`GET /health` para liveness, `GET /health/ready` para
 * readiness) e delega a verificação no banco para a `HealthCheckPort`
 * injetada.
 *
 * @example
 * // Liveness:
 * $ curl http://localhost:3000/health
 * $ {"status":"ok","uptime":42.13}
 *
 * // Readiness:
 * $ curl http://localhost:3000/health/ready
 * $ {"status":"ok","db":"up"} // 200
 * $ {"status":"error","db":"down"} // equivalente a 503 — apenas o shape do body
 *
 * @remarks
 * O shape de response de readiness nunca vaza o erro subjacente
 * (conforme ADR-006 + gotcha do Fastify). Os testes fazem assert
 * explicitamente: veja `health-http.controller.spec.ts`.
 */
export class HealthHttpController {
  constructor(
    @Inject(HEALTH_CHECK_PORT) private readonly healthCheck: HealthCheckPort,
  ) {}

  /**
   * Probe de liveness — não toca em infraestrutura. Retorna o uptime do
   * processo junto com o status `ok` estático para que um operador possa
   * identificar um restart com um único curl.
   */
  @Get()
  liveness(): { status: "ok"; uptime: number } {
    return { status: "ok", uptime: process.uptime() };
  }

  /**
   * Probe de readiness — delega para a HealthCheckPort. Traduz uma rejeição
   * no shape documentado `error`/`down`; nunca vaza o erro subjacente para
   * o wire (conforme ADR-006 + gotcha do Fastify).
   */
  @Get("ready")
  async readiness(): Promise<{ status: "ok" | "error"; db: "up" | "down" }> {
    try {
      await this.healthCheck.ping();
      return { status: "ok", db: "up" };
    } catch {
      return { status: "error", db: "down" };
    }
  }
}
