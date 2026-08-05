import { EmailAlreadyRegisteredError } from "../../domain/errors/email-already-registered.error";
import type { AccessTokenIssuerPort } from "../../domain/ports/access-token-issuer.port";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port";
import type { RefreshTokenGeneratorPort } from "../../domain/ports/refresh-token-generator.port";
import type { RefreshTokenHasherPort } from "../../domain/ports/refresh-token-hasher.port";
import type { RefreshTokenStorePort } from "../../domain/ports/refresh-token-store.port";
import type { UserAuthRepositoryPort } from "../../domain/ports/user-auth.repository.port";
import type { AuthResult } from "../auth-result";

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface RegisterConfig {
  accessTtl: string;
  refreshTtlMs: number;
}

export class RegisterUseCase {
  constructor(
    private readonly users: UserAuthRepositoryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly issuer: AccessTokenIssuerPort,
    private readonly generator: RefreshTokenGeneratorPort,
    private readonly tokenHasher: RefreshTokenHasherPort,
    private readonly store: RefreshTokenStorePort,
  ) {}

  async execute(
    input: RegisterInput,
    config: RegisterConfig,
  ): Promise<AuthResult> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new EmailAlreadyRegisteredError(input.email);
    }
    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });
    return this.issueTokens(user.id, user.email, user.name, user.role, config);
  }

  private async issueTokens(
    userId: string,
    email: string,
    name: string,
    role: string,
    config: RegisterConfig,
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
