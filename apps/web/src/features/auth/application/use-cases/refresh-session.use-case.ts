import type { AuthApiPort } from "../../domain/ports/auth-api.port";
import type { AuthCookieStorePort } from "../../domain/ports/auth-cookie-store.port";

/**
 * Rotaciona a sessão a partir do refresh token armazenado.
 *
 * Resolve o novo access token, ou `null` quando não há nada para atualizar ou
 * a API recusou o token. Tokens que a API omitiu não são gravados, para que
 * uma resposta parcial nunca sobrescreva um cookie ainda válido.
 */
export class RefreshSessionUseCase {
  constructor(
    private readonly api: AuthApiPort,
    private readonly cookies: AuthCookieStorePort,
  ) {}

  async execute(): Promise<string | null> {
    const refreshToken = await this.cookies.getRefreshToken();
    if (!refreshToken) return null;

    const tokens = await this.api.refresh(refreshToken);
    if (!tokens) return null;

    await this.cookies.setTokens(tokens);
    return tokens.accessToken || null;
  }
}
