import type { AuthApiPort } from "../../domain/ports/auth-api.port";
import type { AuthCookieStorePort } from "../../domain/ports/auth-cookie-store.port";

/**
 * Rotates the session from the stored refresh token.
 *
 * Resolves the new access token, or `null` when there is nothing to refresh or
 * the API declined the token. Tokens the API omitted are not written, so a
 * partial response never clobbers a still-valid cookie.
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
