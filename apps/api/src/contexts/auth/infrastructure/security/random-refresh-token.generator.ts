import { randomBytes } from "node:crypto";
import type { RefreshTokenGeneratorPort } from "../../domain/ports/refresh-token-generator.port";

export class RandomRefreshTokenGenerator implements RefreshTokenGeneratorPort {
  generate(): string {
    return randomBytes(48).toString("base64url");
  }
}
