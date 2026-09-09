import { createHash } from "node:crypto";
import type { RefreshTokenHasherPort } from "../../domain/ports/refresh-token-hasher.port";

/**
 * Hasher sha256 para refresh tokens. Espelha o adapter de produção para
 * que os testes exercitem o mesmo formato de fio (wire format).
 */
export class Sha256RefreshTokenHasher implements RefreshTokenHasherPort {
  hash(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }
}
