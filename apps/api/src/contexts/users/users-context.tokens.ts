/**
 * Tokens de DI para o bounded context de users. Usar symbols mantém a
 * `UserRepositoryPort` (uma interface de domínio) resolvível através do
 * Nest DI sem forçar uma dependência em tempo de execução no módulo de
 * domínio.
 */
export const USER_REPOSITORY_PORT = Symbol("UserRepositoryPort");
