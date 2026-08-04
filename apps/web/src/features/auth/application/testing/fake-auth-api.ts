import type {
  AuthApiPort,
  AuthTokens,
  LoginCredentials,
  RegisterCredentials,
} from "../../domain/ports/auth-api.port";
import type { AuthFlowError } from "../../domain/errors/auth-flow.error";

/**
 * Deterministic `AuthApiPort` double. Each operation either resolves the
 * configured tokens or rejects with the configured failure.
 */
export class FakeAuthApi implements AuthApiPort {
  loginResult: AuthTokens | AuthFlowError | Error = {
    accessToken: "access-1",
    refreshToken: "refresh-1",
  };
  registerResult: AuthTokens | AuthFlowError | Error = {
    accessToken: "access-2",
    refreshToken: "refresh-2",
  };
  refreshResult: AuthTokens | null | Error = {
    accessToken: "access-3",
    refreshToken: "refresh-3",
  };
  logoutResult: Error | undefined = undefined;

  readonly loginCalls: LoginCredentials[] = [];
  readonly registerCalls: RegisterCredentials[] = [];
  readonly refreshCalls: string[] = [];
  readonly logoutCalls: string[] = [];

  async login(input: LoginCredentials): Promise<AuthTokens> {
    this.loginCalls.push(input);
    if (this.loginResult instanceof Error) throw this.loginResult;
    return this.loginResult;
  }

  async register(input: RegisterCredentials): Promise<AuthTokens> {
    this.registerCalls.push(input);
    if (this.registerResult instanceof Error) throw this.registerResult;
    return this.registerResult;
  }

  async refresh(refreshToken: string): Promise<AuthTokens | null> {
    this.refreshCalls.push(refreshToken);
    if (this.refreshResult instanceof Error) throw this.refreshResult;
    return this.refreshResult;
  }

  async logout(refreshToken: string): Promise<void> {
    this.logoutCalls.push(refreshToken);
    if (this.logoutResult) throw this.logoutResult;
  }
}
