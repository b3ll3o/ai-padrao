import type { UserListQuery, UserHistoryEntry } from "@ai-padrao/contracts";
import type { User } from "../entities/user";

export interface UserListResult {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Port outbound para persistência de user. Implementada por Adapters de
 * infraestrutura (Prisma, fake de teste em memória, etc.). Os Use Cases
 * da Application dependem apenas dessa Port.
 *
 * Semântica de audit (conforme ADR-014):
 * - `list`, `findById`, `findByEmail`, `update` ignoram linhas soft-deleted.
 * - `softDelete` altera `deletedAt` e escreve uma entrada de histórico.
 * - `restore` limpa `deletedAt` e escreve uma entrada de histórico.
 * - `findByIdIncludingDeleted` retorna a linha independentemente de `deletedAt`.
 * - `getHistory` retorna entradas de histórico ordenadas por `version` asc.
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
