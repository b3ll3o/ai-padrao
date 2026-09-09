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
      // Melhor esforço: mesmo que a revogação falhe, limpa os cookies locais para que o usuário seja deslogado.
      await this.api.logout(refreshToken).catch(() => undefined);
    }

    await this.cookies.clearTokens();
    return this.navigation.login();
  }
}
