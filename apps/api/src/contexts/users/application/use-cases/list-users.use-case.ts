import { UserListQuerySchema, type UserListQuery } from "@ai-padrao/contracts";
import type {
  UserListResult,
  UserRepositoryPort,
} from "../../domain/ports/user-repository.port";

export class ListUsersUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(query: UserListQuery): Promise<UserListResult> {
    // Re-faz o parse da query através do schema do Zod para que os defaults
    // (`page: 1`, `pageSize: 20`) sejam aplicados mesmo quando o
    // `ZodValidationPipe` global ainda não transformou o argumento @Query().
    // Isso mantém o Use Case executável a partir de pontos de entrada
    // não-HTTP (CLI, filas, testes) onde não há Pipe para aplicar os
    // defaults.
    const parsed = UserListQuerySchema.parse(query ?? {});
    return this.users.list(parsed);
  }
}
