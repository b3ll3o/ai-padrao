/**
 * Tokens de DI para o bounded context de auth. Os Ports são resolvidos
 * por meio de Symbols para que os use cases fiquem livres de framework.
 */
export const PASSWORD_HASHER_PORT = Symbol("PasswordHasherPort");
export const ACCESS_TOKEN_ISSUER_PORT = Symbol("AccessTokenIssuerPort");
export const REFRESH_TOKEN_GENERATOR_PORT = Symbol("RefreshTokenGeneratorPort");
export const REFRESH_TOKEN_HASHER_PORT = Symbol("RefreshTokenHasherPort");
export const REFRESH_TOKEN_STORE_PORT = Symbol("RefreshTokenStorePort");
export const USER_AUTH_REPOSITORY_PORT = Symbol("UserAuthRepositoryPort");
/**
 * Token para a config do auth-context em runtime (TTLs de JWT). Declarado aqui
 * para que cada token de DI deste context viva em um único arquivo — a skill
 * ddd-hexagonal proíbe tokens em formato de string.
 */
export const AUTH_CONTEXT_CONFIG = Symbol("AuthContextConfig");
