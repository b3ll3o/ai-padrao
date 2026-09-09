import { InvalidCredentialsError } from "../../domain/errors/invalid-credentials.error";
import type { AccessTokenIssuerPort } from "../../domain/ports/access-token-issuer.port";
import type { RefreshTokenGeneratorPort } from "../../domain/ports/refresh-token-generator.port";
import type { RefreshTokenHasherPort } from "../../domain/ports/refresh-token-hasher.port";
import type { RefreshTokenStorePort } from "../../domain/ports/refresh-token-store.port";
import type { UserAuthRepositoryPort } from "../../domain/ports/user-auth.repository.port";
import type { AuthResult } from "../auth-result";

export interface RefreshInput {
  refreshToken: string;
}

export interface RefreshConfig {
  accessTtl: string;
  refreshTtlMs: number;
}

export class RefreshUseCase {
  constructor(
    private readonly users: UserAuthRepositoryPort,
    private readonly issuer: AccessTokenIssuerPort,
    private readonly generator: RefreshTokenGeneratorPort,
    private readonly tokenHasher: RefreshTokenHasherPort,
    private readonly store: RefreshTokenStorePort,
  ) {}

  async execute(
    input: RefreshInput,
    config: RefreshConfig,
  ): Promise<AuthResult> {
    const tokenHash = this.tokenHasher.hash(input.refreshToken);
    const stored = await this.store.findByHash(tokenHash);
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new InvalidCredentialsError();
    }
    await this.store.revoke(stored.id);
    const user = await this.users.findById(stored.userId);
    if (!user) {
      // O token aponta para um usuário que não existe mais; trate como inválido.
      throw new InvalidCredentialsError();
    }
    return this.issueTokens(user.id, user.email, user.name, user.role, config);
  }

  private async issueTokens(
    userId: string,
    email: string,
    name: string,
    role: string,
    config: RefreshConfig,
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
