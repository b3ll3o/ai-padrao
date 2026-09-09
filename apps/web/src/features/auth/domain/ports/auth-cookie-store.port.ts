import type { AuthTokens } from "./auth-api.port";

/**
 * Lê e escreve os cookies de tokens de auth.
 *
 * Cada método é async porque a implementação do servidor é construída sobre
 * o `cookies()` do Next.js, que é assíncrono no Next 15. As implementações
 * de browser resolvem imediatamente.
 *
 * As implementações DEVEM ignorar valores de token vazios para que uma resposta
 * de refresh parcial nunca sobrescreva um cookie válido com um vazio.
 */
export interface AuthCookieStorePort {
  getAccessToken(): Promise<string | undefined>;
  getRefreshToken(): Promise<string | undefined>;
  setTokens(tokens: AuthTokens): Promise<void>;
  clearTokens(): Promise<void>;
}
