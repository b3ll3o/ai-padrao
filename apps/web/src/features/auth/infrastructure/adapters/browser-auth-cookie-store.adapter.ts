import type { AuthTokens } from "../../domain/ports/auth-api.port";
import type { AuthCookieStorePort } from "../../domain/ports/auth-cookie-store.port";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
} from "./auth-cookie.config";

export interface BrowserAuthCookieOptions {
  /**
   * Se deve acrescentar o atributo `Secure`. É uma thunk, não um boolean, para
   * que o protocolo da página seja lido no momento da escrita — este módulo é
   * importado durante SSR, onde `window` não existe.
   */
  isSecure?: () => boolean;
}

/** Dono de `document.cookie`. Contrapartida client-side do cookie store do servidor. */
export class BrowserAuthCookieStoreAdapter implements AuthCookieStorePort {
  private readonly isSecure: () => boolean;

  constructor(options: BrowserAuthCookieOptions = {}) {
    this.isSecure =
      options.isSecure ?? (() => window.location.protocol === "https:");
  }

  async getAccessToken(): Promise<string | undefined> {
    return this.read(ACCESS_COOKIE);
  }

  async getRefreshToken(): Promise<string | undefined> {
    return this.read(REFRESH_COOKIE);
  }

  async setTokens(tokens: AuthTokens): Promise<void> {
    if (tokens.accessToken) {
      this.write(ACCESS_COOKIE, tokens.accessToken, REFRESH_TTL_SECONDS);
    }
    if (tokens.refreshToken) {
      this.write(REFRESH_COOKIE, tokens.refreshToken, REFRESH_TTL_SECONDS);
    }
  }

  async clearTokens(): Promise<void> {
    this.write(ACCESS_COOKIE, "", 0);
    this.write(REFRESH_COOKIE, "", 0);
  }

  private read(name: string): string | undefined {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  }

  private write(name: string, value: string, maxAgeSeconds: number): void {
    const secure = this.isSecure() ? "; Secure" : "";
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
  }
}
