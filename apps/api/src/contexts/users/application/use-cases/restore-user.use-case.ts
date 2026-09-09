import type { User } from "../../domain/entities/user";
import type { UserRepositoryPort } from "../../domain/ports/user-repository.port";

/**
 * Restaura um user previamente soft-deleted. O user é trazido de volta ao
 * estado ativo (deletedAt limpo, version incrementado, linha de histórico
 * RESTORE escrita). Lança `UserNotFoundError` se o user não existir ou
 * `UserNotDeletedError` se o user já estiver ativo.
 *
 * Destina-se a ser invocado apenas por admins — o Controller aplica o
 * gate de role via `RolesGuard`.
 */
export class RestoreUserUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(id: string, actorId?: string): Promise<User> {
    return this.users.restore(id, actorId);
  }
}
