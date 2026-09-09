import type {
  RefreshTokenRecord,
  RefreshTokenStorePort,
} from "../../domain/ports/refresh-token-store.port";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `rt-${counter}`;
}

/**
 * Fake in-memory de RefreshTokenStorePort para use cases + specs.
 */
export class InMemoryRefreshTokenStore implements RefreshTokenStorePort {
  private readonly byId = new Map<string, RefreshTokenRecord>();
  private readonly byHash = new Map<string, string>();

  constructor(seed: RefreshTokenRecord[] = []) {
    for (const record of seed) {
      this.byId.set(record.id, record);
      this.byHash.set(record.tokenHash, record.id);
    }
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const id = this.byHash.get(tokenHash);
    if (!id) return null;
    return this.byId.get(id) ?? null;
  }

  async revoke(id: string): Promise<void> {
    const record = this.byId.get(id);
    if (!record) return;
    this.byId.set(id, { ...record, revokedAt: new Date() });
  }

  async revokeActiveByHash(tokenHash: string): Promise<void> {
    const id = this.byHash.get(tokenHash);
    if (!id) return;
    const record = this.byId.get(id);
    if (!record || record.revokedAt) return;
    this.byId.set(id, { ...record, revokedAt: new Date() });
  }

  async persist(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    const id = nextId();
    const record: RefreshTokenRecord = {
      id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      revokedAt: null,
      expiresAt: input.expiresAt,
    };
    this.byId.set(id, record);
    this.byHash.set(input.tokenHash, id);
  }
}
