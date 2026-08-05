import { UserNotFoundError } from "../../domain/errors/user-not-found.error";
import type { User } from "../../domain/entities/user";
import type { UserRepositoryPort } from "../../domain/ports/user-repository.port";

export interface UpdateUserInput {
  name?: string;
  email?: string;
}

export class UpdateUserUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(
    id: string,
    patch: UpdateUserInput,
    actorId?: string,
  ): Promise<User> {
    const current = await this.users.findById(id);
    if (!current) throw new UserNotFoundError(id);
    return this.users.update(id, patch, actorId);
  }
}
