import type { UserHistoryEntry, UserListQuery } from "@ai-padrao/contracts";
import { UserNotDeletedError } from "../../domain/errors/user-not-deleted.error";
import { UserNotFoundError } from "../../domain/errors/user-not-found.error";
import type { User } from "../../domain/entities/user";
import { Email } from "../../domain/value-objects/email";
import { Name } from "../../domain/value-objects/name";
import type {
  UserListResult,
  UserRepositoryPort,
} from "../../domain/ports/user-repository.port";

interface InternalUserRecord {
  user: User;
}

/**
 * Implementação em memória do UserRepositoryPort para testes e fakes.
 *
 * A semântica de audit espelha a `PrismaUserRepository`:
 *  - `list` / `findById` / `findByEmail` / `update` ignoram users soft-deleted.
 *  - `softDelete` altera `deletedAt` e escreve uma entrada de histórico.
 *  - `restore` limpa `deletedAt` e escreve uma entrada de histórico.
 *  - `findByIdIncludingDeleted` retorna a linha independentemente de `deletedAt`.
 *  - `getHistory` retorna entradas de histórico ordenadas por `version` asc.
 *
 * O histórico é mantido por user em um map para que os testes possam fazer
 * asserts nele sem uma segunda coleção.
 */
export class InMemoryUserRepository implements UserRepositoryPort {
  private readonly store = new Map<string, InternalUserRecord>();
  private readonly history = new Map<string, UserHistoryEntry[]>();
  private historySeq = 0;

  constructor(seed: User[] = []) {
    for (const user of seed) {
      this.store.set(user.id, { user });
    }
  }

  async list(query: UserListQuery): Promise<UserListResult> {
    const { page, pageSize, q } = query;
    const all = [...this.store.values()]
      .filter((r) => r.user.deletedAt === null)
      .map((r) => r.user);
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
    const record = this.store.get(id);
    if (!record) return null;
    if (record.user.deletedAt !== null) return null;
    return record.user;
  }

  async findByIdIncludingDeleted(id: string): Promise<User | null> {
    return this.store.get(id)?.user ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const needle = email.trim().toLowerCase();
    for (const { user } of this.store.values()) {
      if (user.deletedAt !== null) continue;
      if (user.email.value === needle) return user;
    }
    return null;
  }

  async update(
    id: string,
    patch: { name?: string; email?: string },
    actorId?: string,
  ): Promise<User> {
    const current = this.store.get(id)?.user;
    if (!current) throw new UserNotFoundError(id);
    if (current.deletedAt !== null) throw new UserNotFoundError(id);
    let next = current;
    if (patch.name !== undefined) {
      next = next.rename(Name.create(patch.name));
    }
    if (patch.email !== undefined) {
      next = next.changeEmail(Email.create(patch.email));
    }
    if (next === current) return current; // rename/email no-op mantém version e não escreve histórico
    this.store.set(id, { user: next });
    this.appendHistory(id, "UPDATE", actorId, current, next.version);
    return next;
  }

  async softDelete(id: string, actorId?: string): Promise<void> {
    const record = this.store.get(id);
    if (!record) throw new UserNotFoundError(id);
    if (record.user.deletedAt !== null) return; // já está deleted; sem linha de histórico
    const now = new Date();
    const next = record.user.markDeleted(now);
    this.store.set(id, { user: next });
    this.appendHistory(id, "DELETE", actorId, record.user, next.version);
  }

  async restore(id: string, actorId?: string): Promise<User> {
    const record = this.store.get(id);
    if (!record) throw new UserNotFoundError(id);
    if (record.user.deletedAt === null) throw new UserNotDeletedError(id);
    const next = record.user.restore();
    this.store.set(id, { user: next });
    this.appendHistory(id, "RESTORE", actorId, record.user, next.version);
    return next;
  }

  async getHistory(id: string): Promise<UserHistoryEntry[]> {
    return [...(this.history.get(id) ?? [])].sort(
      (a, b) => a.version - b.version,
    );
  }

  /**
   * Conveniência exclusiva para testes: semeia uma entrada inicial CREATE
   * (para que o histórico exista antes de qualquer mutação). Use isso nas
   * factories de teste.
   */
  seedCreateHistory(user: User): void {
    this.appendHistory(user.id, "CREATE", undefined, user, user.version);
  }

  private appendHistory(
    originalId: string,
    operation: "CREATE" | "UPDATE" | "DELETE" | "RESTORE",
    changedBy: string | undefined,
    prior: User,
    newVersion: number,
  ): void {
    const id = `hist_${++this.historySeq}`;
    const entry: UserHistoryEntry = {
      id,
      originalId,
      version: newVersion,
      operation,
      changedAt: new Date(),
      changedBy: changedBy ?? null,
      snapshot: prior.toJSON() as unknown,
    };
    const list = this.history.get(originalId) ?? [];
    list.push(entry);
    this.history.set(originalId, list);
  }
}
