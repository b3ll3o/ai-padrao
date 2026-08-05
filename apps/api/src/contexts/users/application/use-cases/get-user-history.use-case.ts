import type { UserHistoryEntry } from "@ai-padrao/contracts";
import type { UserRepositoryPort } from "../../domain/ports/user-repository.port";

/**
 * Returns the full audit history of a user, ordered by `version` ascending.
 * The history captures every CREATE/UPDATE/DELETE/RESTORE that affected the
 * user (per ADR-014).
 *
 * Intended to be invoked only by admins — the controller enforces role
 * gating via `RolesGuard`.
 */
export class GetUserHistoryUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(id: string): Promise<UserHistoryEntry[]> {
    return this.users.getHistory(id);
  }
}
