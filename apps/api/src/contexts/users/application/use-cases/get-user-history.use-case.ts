import type { UserHistoryEntry } from "@ai-padrao/contracts";
import type { UserRepositoryPort } from "../../domain/ports/user-repository.port";

/**
 * Retorna o histórico completo de audit de um user, ordenado por `version`
 * ascendente. O histórico captura cada CREATE/UPDATE/DELETE/RESTORE que
 * afetou o user (conforme ADR-014).
 *
 * Destina-se a ser invocado apenas por admins — o Controller aplica o
 * gate de role via `RolesGuard`.
 */
export class GetUserHistoryUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(id: string): Promise<UserHistoryEntry[]> {
    return this.users.getHistory(id);
  }
}
