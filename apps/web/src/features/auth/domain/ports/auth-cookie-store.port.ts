import type { AuthTokens } from "./auth-api.port";

/**
 * Reads and writes the auth token cookies.
 *
 * Every method is async because the server implementation sits on top of
 * Next.js `cookies()`, which is asynchronous in Next 15. Browser
 * implementations resolve immediately.
 *
 * Implementations MUST skip empty token values so a partial refresh response
 * never overwrites a good cookie with an empty one.
 */
export interface AuthCookieStorePort {
  getAccessToken(): Promise<string | undefined>;
  getRefreshToken(): Promise<string | undefined>;
  setTokens(tokens: AuthTokens): Promise<void>;
  clearTokens(): Promise<void>;
}
