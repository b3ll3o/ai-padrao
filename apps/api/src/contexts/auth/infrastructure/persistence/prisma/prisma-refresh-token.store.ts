// O Nest DI + emitDecoratorMetadata precisam do valor em runtime aqui; `import type` o apaga.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../../../../infra/prisma/prisma.service";
import type {
  RefreshTokenRecord,
  RefreshTokenStorePort,
} from "../../../domain/ports/refresh-token-store.port";

export class PrismaRefreshTokenStore implements RefreshTokenStorePort {
  constructor(private readonly prisma: PrismaService) {}

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      revokedAt: row.revokedAt,
      expiresAt: row.expiresAt,
    };
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeActiveByHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async persist(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
  }
}
