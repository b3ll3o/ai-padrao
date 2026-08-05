// Framework-free value object for user email. Mirrors the Zod contract
// regex in packages/contracts so we do not depend on Zod inside domain.

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
