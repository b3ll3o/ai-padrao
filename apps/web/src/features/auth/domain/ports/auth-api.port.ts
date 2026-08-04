export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
}

/**
 * Transport-agnostic view of the auth API. Implementations own the concrete
 * HTTP client and translate non-OK responses into `AuthFlowError`.
 */
export interface AuthApiPort {
  login(input: LoginCredentials): Promise<AuthTokens>;
  register(input: RegisterCredentials): Promise<AuthTokens>;
  /** Resolves `null` when the refresh token is no longer accepted. */
  refresh(refreshToken: string): Promise<AuthTokens | null>;
  logout(refreshToken: string): Promise<void>;
}
