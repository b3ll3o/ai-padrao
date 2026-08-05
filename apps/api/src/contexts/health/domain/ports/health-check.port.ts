/**
 * Outbound port for infrastructure-level health probes. Implemented by
 * adapters (Prisma today, possibly Redis / S3 / etc. later). The HTTP
 * controller depends only on this port — never on Prisma directly.
 *
 * `ping()` resolves on success and rejects on failure. The controller
 * translates rejection into the readiness response shape; it must not
 * leak the underlying error to the wire.
 *
 * @example
 *   // Mock for unit tests:
 *   const port: HealthCheckPort = { ping: async () => undefined };
 *
 * @remarks
 *   Kept framework-free on purpose — this file lives under `domain/`
 *   and MUST NOT import `@nestjs/*`, `@prisma/*`, or any infrastructure
 *   module. New health probes (Redis, queue, external API) belong in
 *   `infrastructure/persistence/` or `infrastructure/http/` and must
 *   implement this interface.
 */
export interface HealthCheckPort {
  ping(): Promise<void>;
}
