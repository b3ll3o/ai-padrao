// Nest DI + emitDecoratorMetadata need the runtime value here; `import type` erases it.
 
import { Module } from "@nestjs/common";
import { FindUserUseCase } from "./application/use-cases/find-user.use-case";
import { ListUsersUseCase } from "./application/use-cases/list-users.use-case";
import { RemoveUserUseCase } from "./application/use-cases/remove-user.use-case";
import { UpdateUserUseCase } from "./application/use-cases/update-user.use-case";
import { UserMapper } from "./infrastructure/persistence/prisma/user.mapper";
import { PrismaUserRepository } from "./infrastructure/persistence/prisma/prisma-user.repository";
import { UsersHttpController } from "./infrastructure/http/users-http.controller";
import { USER_REPOSITORY_PORT } from "./users-context.tokens";

/**
 * Composition root for the users bounded context. Wires the persistence
 * adapter into the port token and instantiates the use cases + HTTP
 * adapter from there. Application code only depends on the port.
 */
@Module({
  controllers: [UsersHttpController],
  providers: [
    PrismaUserRepository,
    UserMapper,
    {
      provide: USER_REPOSITORY_PORT,
      useExisting: PrismaUserRepository,
    },
    {
      provide: ListUsersUseCase,
      useFactory: (repo) => new ListUsersUseCase(repo),
      inject: [USER_REPOSITORY_PORT],
    },
    {
      provide: FindUserUseCase,
      useFactory: (repo) => new FindUserUseCase(repo),
      inject: [USER_REPOSITORY_PORT],
    },
    {
      provide: UpdateUserUseCase,
      useFactory: (repo) => new UpdateUserUseCase(repo),
      inject: [USER_REPOSITORY_PORT],
    },
    {
      provide: RemoveUserUseCase,
      useFactory: (repo) => new RemoveUserUseCase(repo),
      inject: [USER_REPOSITORY_PORT],
    },
  ],
  exports: [USER_REPOSITORY_PORT],
})
export class UsersContextModule {}
