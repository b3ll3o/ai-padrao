import type { UserListQuery } from "@ai-padrao/contracts";
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
 */
export interface UserRepositoryPort {
  list(query: UserListQuery): Promise<UserListResult>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, patch: { name?: string; email?: string }): Promise<User>;
  delete(id: string): Promise<void>;
}
