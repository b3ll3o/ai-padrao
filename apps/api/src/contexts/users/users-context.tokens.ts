/**
 * DI tokens for the users bounded context. Using symbols keeps the
 * `UserRepositoryPort` (a domain interface) resolvable through Nest DI
 * without forcing a runtime dependency on the domain module.
 */
export const USER_REPOSITORY_PORT = Symbol("UserRepositoryPort");
