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
 * Visão agnóstica de transporte da auth API. As implementações possuem o
 * HTTP client concreto e traduzem respostas não-OK em `AuthFlowError`.
 */
export interface AuthApiPort {
  login(input: LoginCredentials): Promise<AuthTokens>;
  register(input: RegisterCredentials): Promise<AuthTokens>;
  /** Resolve `null` quando o refresh token não é mais aceito. */
  refresh(refreshToken: string): Promise<AuthTokens | null>;
  logout(refreshToken: string): Promise<void>;
}
