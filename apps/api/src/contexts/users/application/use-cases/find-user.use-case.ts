import { UserNotFoundError } from "../../domain/errors/user-not-found.error";
import type { User } from "../../domain/entities/user";
import type { UserRepositoryPort } from "../../domain/ports/user-repository.port";

export class FindUserUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new UserNotFoundError(id);
    return user;
  }
}
