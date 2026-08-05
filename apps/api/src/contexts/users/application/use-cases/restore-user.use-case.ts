import type { User } from "../../domain/entities/user";
import type { UserRepositoryPort } from "../../domain/ports/user-repository.port";

/**
 * Restores a previously soft-deleted user. The user is brought back to
 * the active state (deletedAt cleared, version bumped, RESTORE history
 * row written). Throws `UserNotFoundError` if the user does not exist or
 * `UserNotDeletedError` if the user is already active.
 *
 * Intended to be invoked only by admins — the controller enforces role
 * gating via `RolesGuard`.
 */
export class RestoreUserUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(id: string, actorId?: string): Promise<User> {
    return this.users.restore(id, actorId);
  }
}
