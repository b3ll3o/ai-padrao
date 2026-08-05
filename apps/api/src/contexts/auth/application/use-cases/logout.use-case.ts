import type { RefreshTokenHasherPort } from "../../domain/ports/refresh-token-hasher.port";
import type { RefreshTokenStorePort } from "../../domain/ports/refresh-token-store.port";

export interface LogoutInput {
  refreshToken: string;
}

export class LogoutUseCase {
  constructor(
    private readonly tokenHasher: RefreshTokenHasherPort,
    private readonly store: RefreshTokenStorePort,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const tokenHash = this.tokenHasher.hash(input.refreshToken);
    await this.store.revokeActiveByHash(tokenHash);
  }
}
