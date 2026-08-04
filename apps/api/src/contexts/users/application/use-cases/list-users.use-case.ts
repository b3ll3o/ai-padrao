import type { UserListQuery } from "@ai-padrao/contracts";
import type {
  UserListResult,
  UserRepositoryPort,
} from "../../domain/ports/user-repository.port";

export class ListUsersUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(query: UserListQuery): Promise<UserListResult> {
    return this.users.list(query);
  }
}
