import { AuthFlowError } from "../../domain/errors/auth-flow.error";
import type {
  AuthApiPort,
  AuthTokens,
  LoginCredentials,
  RegisterCredentials,
} from "../../domain/ports/auth-api.port";

/**
 * Dono de `fetch`. O único lugar na feature de auth que fala HTTP.
 *
 * `fetchFn` tem como default uma thunk em vez do próprio `fetch`, para que o
 * global seja resolvido a cada chamada (e nunca invocado com o adapter como
 * seu receiver).
 */
export class FetchAuthApiAdapter implements AuthApiPort {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = (input, init) =>
      fetch(input, init),
  ) {}

  async login(input: LoginCredentials): Promise<AuthTokens> {
    return this.authenticate("/api/auth/login", input);
  }

  async register(input: RegisterCredentials): Promise<AuthTokens> {
    return this.authenticate("/api/auth/register", input);
  }

  async refresh(refreshToken: string): Promise<AuthTokens | null> {
    const res = await this.fetchFn(`${this.baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      credentials: "include",
    });
    if (!res.ok) return null;

    const data = await res.json();
    return {
      accessToken: data.accessToken ?? "",
      refreshToken: data.refreshToken ?? "",
    };
  }

  async logout(refreshToken: string): Promise<void> {
    // A revogação é de melhor esforço; o chamador limpa os cookies locais independentemente.
    await this.fetchFn(`${this.baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  }

  private async authenticate(
    path: string,
    input: LoginCredentials | RegisterCredentials,
  ): Promise<AuthTokens> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new AuthFlowError(body.message);
    }

    const data = await res.json();
    return { accessToken: data.accessToken, refreshToken: data.refreshToken };
  }
}
