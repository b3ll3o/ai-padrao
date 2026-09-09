import type {
  CreateUserAuthInput,
  UserAuthRecord,
  UserAuthRepositoryPort,
} from "../../domain/ports/user-auth.repository.port";

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/**
 * Fake in-memory de UserAuthRepositoryPort para use cases + specs.
 */
export class InMemoryUserAuthRepository implements UserAuthRepositoryPort {
  private readonly byId = new Map<string, UserAuthRecord>();

  constructor(seed: UserAuthRecord[] = []) {
    for (const user of seed) this.byId.set(user.id, user);
  }

  async findByEmail(email: string): Promise<UserAuthRecord | null> {
    const needle = email.trim().toLowerCase();
    for (const user of this.byId.values()) {
      if (user.email === needle) return user;
    }
    return null;
  }

  async findById(id: string): Promise<UserAuthRecord | null> {
    return this.byId.get(id) ?? null;
  }

  async create(input: CreateUserAuthInput): Promise<UserAuthRecord> {
    const id = nextId("u");
    const user: UserAuthRecord = {
      id,
      email: input.email.trim().toLowerCase(),
      name: input.name,
      role: "USER",
      passwordHash: input.passwordHash,
    };
    this.byId.set(id, user);
    return user;
  }

  /** Helper de teste: insere um registro com id fixo para que outros fakes possam apontar para ele. */
  seed(record: UserAuthRecord): void {
    this.byId.set(record.id, record);
  }
}
