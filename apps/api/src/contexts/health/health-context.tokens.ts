/**
 * DI tokens for the health bounded context. Using symbols keeps the
 * `HealthCheckPort` (a domain interface) resolvable through Nest DI
 * without forcing a runtime dependency on the domain module.
 *
 * @example
 *   // Inject the port (typically inside the HTTP controller):
 *   constructor(@Inject(HEALTH_CHECK_PORT) private readonly check: HealthCheckPort) {}
 *
 * @remarks
 *   Add new symbols here whenever a new outbound port is declared in
 *   `domain/ports/`. Convention: `<ENTITY>_<ROLE>_PORT` in
 *   UPPER_SNAKE_CASE; description string is for debugging only.
 */
export const HEALTH_CHECK_PORT = Symbol("HealthCheckPort");
