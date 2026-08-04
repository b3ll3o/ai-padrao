import type { UserListQuery } from "@ai-padrao/contracts";
import { UserNotFoundError } from "../../domain/errors/user-not-found.error";
import type { User } from "../../domain/entities/user";
import { Email } from "../../domain/value-objects/email";
import { Name } from "../../domain/value-objects/name";
import type {
  UserListResult,
  UserRepositoryPort,
} from "../../domain/ports/user-repository.port";

/**
 * In-memory implementation of UserRepositoryPort for tests and fakes.
 * Semantics mirror the legacy UsersService behavior:
 * - case-insensitive OR match on email/name when q is provided
 * - pagination via skip/take
 * - orderBy createdAt desc
 */
export class InMemoryUserRepository implements UserRepositoryPort {
  private readonly store = new Map<string, User>();

  constructor(seed: User[] = []) {
    for (const user of seed) {
      this.store.set(user.id, user);
    }
  }

  async list(query: UserListQuery): Promise<UserListResult> {
    const { page, pageSize, q } = query;
    const all = [...this.store.values()];
    const filtered = q
      ? all.filter((user) => {
          const needle = q.toLowerCase();
          return (
            user.email.value.includes(needle) ||
            user.name.value.toLowerCase().includes(needle)
          );
        })
      : all;
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = filtered.length;
    const skip = (page - 1) * pageSize;
    const items = filtered.slice(skip, skip + pageSize);
    return { items, total, page, pageSize };
  }

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const needle = email.trim().toLowerCase();
    for (const user of this.store.values()) {
      if (user.email.value === needle) return user;
    }
    return null;
  }

  async update(
    id: string,
    patch: { name?: string; email?: string },
  ): Promise<User> {
    const current = this.store.get(id);
    if (!current) throw new UserNotFoundError(id);
    let next = current;
    if (patch.name !== undefined) {
      next = next.rename(Name.create(patch.name));
    }
    if (patch.email !== undefined) {
      next = next.changeEmail(Email.create(patch.email));
    }
    this.store.set(id, next);
    return next;
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) throw new UserNotFoundError(id);
    this.store.delete(id);
  }
}
