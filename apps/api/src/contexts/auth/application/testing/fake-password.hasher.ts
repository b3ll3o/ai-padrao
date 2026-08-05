import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port";

/**
 * Deterministic fake hasher. Good enough for unit tests — not for
 * production. Production wiring uses the argon2-backed adapter.
 */
export class FakePasswordHasher implements PasswordHasherPort {
  private readonly records = new Map<string, string>();

  async hash(plain: string): Promise<string> {
    const hash = `fake:${plain}`;
    this.records.set(plain, hash);
    return hash;
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return this.records.get(plain) === hash || hash === `fake:${plain}`;
  }
}
