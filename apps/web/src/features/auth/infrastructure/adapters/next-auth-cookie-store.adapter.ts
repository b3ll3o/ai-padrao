import { cookies } from "next/headers";
import type { AuthTokens } from "../../domain/ports/auth-api.port";
import type { AuthCookieStorePort } from "../../domain/ports/auth-cookie-store.port";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
} from "./auth-cookie.config";

export interface NextAuthCookieOptions {
  /** Define o atributo `Secure` — dirigido pelo esquema da web origin configurada. */
  secure: boolean;
}

/** Dono de `next/headers`. IO server-side de cookies para a feature de auth. */
export class NextAuthCookieStoreAdapter implements AuthCookieStorePort {
  constructor(private readonly options: NextAuthCookieOptions) {}

  async getAccessToken(): Promise<string | undefined> {
    const store = await cookies();
    return store.get(ACCESS_COOKIE)?.value;
  }

  async getRefreshToken(): Promise<string | undefined> {
    const store = await cookies();
    return store.get(REFRESH_COOKIE)?.value;
  }

  async setTokens(tokens: AuthTokens): Promise<void> {
    const store = await cookies();
    if (tokens.refreshToken) {
      store.set(this.descriptor(REFRESH_COOKIE, tokens.refreshToken));
    }
    if (tokens.accessToken) {
      store.set(this.descriptor(ACCESS_COOKIE, tokens.accessToken));
    }
  }

  async clearTokens(): Promise<void> {
    const store = await cookies();
    store.delete(REFRESH_COOKIE);
    store.delete(ACCESS_COOKIE);
  }

  private descriptor(name: string, value: string) {
    return {
      name,
      value,
      httpOnly: false,
      secure: this.options.secure,
      sameSite: "lax" as const,
      path: "/",
      maxAge: REFRESH_TTL_SECONDS,
    };
  }
}
