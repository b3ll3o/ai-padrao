import { createHash } from "node:crypto";
import type { RefreshTokenHasherPort } from "../../domain/ports/refresh-token-hasher.port";

/**
 * sha256 hasher for refresh tokens. Mirrors the production adapter so
 * tests exercise the same wire format.
 */
export class Sha256RefreshTokenHasher implements RefreshTokenHasherPort {
  hash(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }
}
