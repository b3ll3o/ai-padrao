/**
 * Port outbound para probes de health a nível de infraestrutura.
 * Implementada por Adapters (Prisma hoje, possivelmente Redis / S3 / etc.
 * no futuro). O Controller HTTP depende apenas desta Port — nunca do
 * Prisma diretamente.
 *
 * `ping()` resolve em caso de sucesso e rejeita em caso de falha. O
 * Controller traduz a rejeição no shape de response de readiness; ele não
 * deve vazar o erro subjacente para o wire.
 *
 * @example
 *   // Mock para testes unitários:
 *   const port: HealthCheckPort = { ping: async () => undefined };
 *
 * @remarks
 *   Mantido framework-free de propósito — este arquivo mora sob `domain/`
 *   e NÃO DEVE importar `@nestjs/*`, `@prisma/*`, nem qualquer módulo de
 *   infraestrutura. Novos probes de health (Redis, queue, API externa)
 *   pertencem a `infrastructure/persistence/` ou `infrastructure/http/` e
 *   devem implementar esta interface.
 */
export interface HealthCheckPort {
  ping(): Promise<void>;
}
