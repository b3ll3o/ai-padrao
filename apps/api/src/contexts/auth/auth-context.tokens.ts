/**
 * DI tokens for the auth bounded context. Ports are resolved through
 * symbols so use cases stay framework-free.
 */
export const PASSWORD_HASHER_PORT = Symbol("PasswordHasherPort");
export const ACCESS_TOKEN_ISSUER_PORT = Symbol("AccessTokenIssuerPort");
export const REFRESH_TOKEN_GENERATOR_PORT = Symbol("RefreshTokenGeneratorPort");
export const REFRESH_TOKEN_HASHER_PORT = Symbol("RefreshTokenHasherPort");
export const REFRESH_TOKEN_STORE_PORT = Symbol("RefreshTokenStorePort");
export const USER_AUTH_REPOSITORY_PORT = Symbol("UserAuthRepositoryPort");
