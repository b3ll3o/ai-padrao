import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port";

/**
 * Hasher fake determinístico. Suficiente para testes unit — não serve
 * para produção. A wiring de produção usa o adapter baseado em argon2.
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
