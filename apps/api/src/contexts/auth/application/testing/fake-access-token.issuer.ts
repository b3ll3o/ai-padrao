import type {
  AccessTokenIssuerPort,
  AccessTokenPayload,
} from "../../domain/ports/access-token-issuer.port";

export class FakeAccessTokenIssuer implements AccessTokenIssuerPort {
  signCount = 0;
  lastPayload: AccessTokenPayload | null = null;
  lastTtl: string | null = null;

  async sign(payload: AccessTokenPayload, ttl: string): Promise<string> {
    this.signCount += 1;
    this.lastPayload = payload;
    this.lastTtl = ttl;
    return `fake.${payload.sub}.${ttl}`;
  }
}
