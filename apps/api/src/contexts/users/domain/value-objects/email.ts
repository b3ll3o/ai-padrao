// Value Object framework-free para o email de user. Espelha o regex do
// contrato Zod em packages/contracts para que não dependamos do Zod dentro
// do domínio.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const trimmed = raw.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) {
      throw new Error(`Invalid email: ${raw}`);
    }
    return new Email(trimmed);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
