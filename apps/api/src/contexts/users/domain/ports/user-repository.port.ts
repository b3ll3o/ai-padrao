import type { UserListQuery, UserHistoryEntry } from "@ai-padrao/contracts";
import type { User } from "../entities/user";

export interface UserListResult {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Outbound port for user persistence. Implemented by infrastructure
 * adapters (Prisma, in-memory test fake, etc.). Application use cases
 * depend only on this port.
 *
 * Audit semantics (per ADR-014):
 * - `list`, `findById`, `findByEmail`, `update` skip soft-deleted rows.
 * - `softDelete` flips `deletedAt` and writes a history entry.
 * - `restore` clears `deletedAt` and writes a history entry.
 * - `findByIdIncludingDeleted` returns the row regardless of `deletedAt`.
 * - `getHistory` returns history entries ordered by `version` asc.
 */
export interface UserRepositoryPort {
  list(query: UserListQuery): Promise<UserListResult>;
  findById(id: string): Promise<User | null>;
  findByIdIncludingDeleted(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(
    id: string,
    patch: { name?: string; email?: string },
    actorId?: string,
  ): Promise<User>;
  softDelete(id: string, actorId?: string): Promise<void>;
  restore(id: string, actorId?: string): Promise<User>;
  getHistory(id: string): Promise<UserHistoryEntry[]>;
}
