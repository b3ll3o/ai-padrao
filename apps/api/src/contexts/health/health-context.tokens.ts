/**
 * Tokens de DI para o bounded context de health. Usar symbols mantém a
 * `HealthCheckPort` (uma interface de domínio) resolvível através do
 * Nest DI sem forçar uma dependência em tempo de execução no módulo de
 * domínio.
 *
 * @example
 *   // Injeta a Port (tipicamente dentro do Controller HTTP):
 *   constructor(@Inject(HEALTH_CHECK_PORT) private readonly check: HealthCheckPort) {}
 *
 * @remarks
 *   Adicione novos symbols aqui sempre que uma nova Port outbound for
 *   declarada em `domain/ports/`. Convenção: `<ENTITY>_<ROLE>_PORT` em
 *   UPPER_SNAKE_CASE; a string de descrição serve apenas para debug.
 */
export const HEALTH_CHECK_PORT = Symbol("HealthCheckPort");
