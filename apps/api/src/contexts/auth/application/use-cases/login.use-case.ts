import { InvalidCredentialsError } from "../../domain/errors/invalid-credentials.error";
import type { AccessTokenIssuerPort } from "../../domain/ports/access-token-issuer.port";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port";
import type { RefreshTokenGeneratorPort } from "../../domain/ports/refresh-token-generator.port";
import type { RefreshTokenHasherPort } from "../../domain/ports/refresh-token-hasher.port";
import type { RefreshTokenStorePort } from "../../domain/ports/refresh-token-store.port";
import type { UserAuthRepositoryPort } from "../../domain/ports/user-auth.repository.port";
import type { AuthResult } from "../auth-result";

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginConfig {
  accessTtl: string;
  refreshTtlMs: number;
}

export class LoginUseCase {
  constructor(
    private readonly users: UserAuthRepositoryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly issuer: AccessTokenIssuerPort,
    private readonly generator: RefreshTokenGeneratorPort,
    private readonly tokenHasher: RefreshTokenHasherPort,
    private readonly store: RefreshTokenStorePort,
  ) {}

  async execute(input: LoginInput, config: LoginConfig): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      throw new InvalidCredentialsError();
    }
    const valid = await this.hasher.verify(input.password, user.passwordHash);
    if (!valid) {
      throw new InvalidCredentialsError();
    }
    return this.issueTokens(user.id, user.email, user.name, user.role, config);
  }

  private async issueTokens(
    userId: string,
    email: string,
    name: string,
    role: string,
    config: LoginConfig,
  ): Promise<AuthResult> {
    const accessToken = await this.issuer.sign(
      { sub: userId, email, role },
      config.accessTtl,
    );
    const refreshToken = this.generator.generate();
    await this.store.persist({
      userId,
      tokenHash: this.tokenHasher.hash(refreshToken),
      expiresAt: new Date(Date.now() + config.refreshTtlMs),
    });
    return {
      user: { id: userId, email, name, role },
      accessToken,
      refreshToken,
    };
  }
}
