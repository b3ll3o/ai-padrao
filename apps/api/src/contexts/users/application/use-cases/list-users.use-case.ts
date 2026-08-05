import { UserListQuerySchema, type UserListQuery } from "@ai-padrao/contracts";
import type {
  UserListResult,
  UserRepositoryPort,
} from "../../domain/ports/user-repository.port";

export class ListUsersUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(query: UserListQuery): Promise<UserListResult> {
    // Re-parse the query through the Zod schema so defaults (`page: 1`,
    // `pageSize: 20`) apply even when the global `ZodValidationPipe`
    // hasn't transformed the @Query() argument. This keeps the use case
    // runnable from non-HTTP entry points (CLI, queues, tests) where
    // there is no pipe to apply the defaults.
    const parsed = UserListQuerySchema.parse(query ?? {});
    return this.users.list(parsed);
  }
}
