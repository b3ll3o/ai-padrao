import type { AuthApiPort } from "../../domain/ports/auth-api.port";
import type { AuthCookieStorePort } from "../../domain/ports/auth-cookie-store.port";
import type { AuthNavigationPort } from "../../domain/ports/auth-navigation.port";

export class LogoutUseCase {
  constructor(
    private readonly api: AuthApiPort,
    private readonly cookies: AuthCookieStorePort,
    private readonly navigation: AuthNavigationPort,
  ) {}

  async execute(): Promise<void> {
    const refreshToken = await this.cookies.getRefreshToken();

    if (refreshToken) {
      // Best-effort: even if revoke fails, clear local cookies so the user is logged out.
      await this.api.logout(refreshToken).catch(() => undefined);
    }

    await this.cookies.clearTokens();
    return this.navigation.login();
  }
}
