// Nest DI needs the runtime value here; `import type` erases it from design:paramtypes.

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
 * HTTP adapter for the health bounded context. Exposes the two
 * orchestrator probes (`GET /health` for liveness,
 * `GET /health/ready` for readiness) and delegates the database
 * check to the injected `HealthCheckPort`.
 *
 * @example
 *   // Liveness:
 *   $ curl http://localhost:3000/health
 *   $ {"status":"ok","uptime":42.13}
 *
 *   // Readiness:
 *   $ curl http://localhost:3000/health/ready
 *   $ {"status":"ok","db":"up"}      // 200
 *   $ {"status":"error","db":"down"} // 503-equivalent — body shape only
 *
 * @remarks
 *   The readiness response shape never leaks the underlying error
 *   (per ADR-006 + Fastify gotcha INC-002). Tests assert this
 *   explicitly: see `health-http.controller.spec.ts`.
 */
export class HealthHttpController {
  constructor(
    @Inject(HEALTH_CHECK_PORT) private readonly healthCheck: HealthCheckPort,
  ) {}

  /**
   * Liveness probe — does not touch infrastructure. Returns process
   * uptime alongside the static `ok` status so an operator can spot a
   * restart from a single curl.
   */
  @Get()
  liveness(): { status: "ok"; uptime: number } {
    return { status: "ok", uptime: process.uptime() };
  }

  /**
   * Readiness probe — delegates to the HealthCheckPort. Translates a
   * rejection into the documented `error`/`down` shape; never leaks the
   * underlying error to the wire (per ADR-006 + Fastify gotcha INC-002).
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
