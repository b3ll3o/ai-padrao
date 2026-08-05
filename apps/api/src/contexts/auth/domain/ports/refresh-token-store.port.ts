export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  revokedAt: Date | null;
  expiresAt: Date;
}

export interface RefreshTokenStorePort {
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(id: string): Promise<void>;
  revokeActiveByHash(tokenHash: string): Promise<void>;
  persist(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
}
