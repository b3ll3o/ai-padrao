import { createHash } from "node:crypto";
import type { RefreshTokenHasherPort } from "../../domain/ports/refresh-token-hasher.port";

export class Sha256RefreshTokenHasher implements RefreshTokenHasherPort {
  hash(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }
}
