import type { AuthCookieStorePort } from "../../domain/ports/auth-cookie-store.port";
import type { AuthTokens } from "../../domain/ports/auth-api.port";

/**
 * `AuthCookieStorePort` em memória. Espelha o contrato de produção ignorando
 * valores de token vazios em vez de armazená-los.
 */
export class InMemoryAuthCookieStore implements AuthCookieStorePort {
  accessToken: string | undefined;
  refreshToken: string | undefined;
  cleared = 0;

  constructor(initial: { accessToken?: string; refreshToken?: string } = {}) {
    this.accessToken = initial.accessToken;
    this.refreshToken = initial.refreshToken;
  }

  async getAccessToken(): Promise<string | undefined> {
    return this.accessToken;
  }

  async getRefreshToken(): Promise<string | undefined> {
    return this.refreshToken;
  }

  async setTokens(tokens: AuthTokens): Promise<void> {
    if (tokens.accessToken) this.accessToken = tokens.accessToken;
    if (tokens.refreshToken) this.refreshToken = tokens.refreshToken;
  }

  async clearTokens(): Promise<void> {
    this.cleared += 1;
    this.accessToken = undefined;
    this.refreshToken = undefined;
  }
}
