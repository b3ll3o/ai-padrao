// Value Object framework-free para o nome de user. Espelha a constraint
// do contrato Zod: string sem espaços nas pontas, 1..120 caracteres.

export class Name {
  private constructor(readonly value: string) {}

  static create(raw: string): Name {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new Error("Name must not be empty");
    }
    if (trimmed.length > 120) {
      throw new Error("Name must be at most 120 characters");
    }
    return new Name(trimmed);
  }

  equals(other: Name): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
