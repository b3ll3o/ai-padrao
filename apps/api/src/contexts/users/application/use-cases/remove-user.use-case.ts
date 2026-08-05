import { UserNotFoundError } from "../../domain/errors/user-not-found.error";
import type { UserRepositoryPort } from "../../domain/ports/user-repository.port";

export class RemoveUserUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(id: string): Promise<void> {
    const current = await this.users.findById(id);
    if (!current) throw new UserNotFoundError(id);
    await this.users.delete(id);
  }
}
