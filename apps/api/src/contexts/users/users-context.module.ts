// Nest DI + emitDecoratorMetadata precisam do valor em tempo de execução aqui; `import type` o apaga.

import { Module } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { FindUserUseCase } from "./application/use-cases/find-user.use-case";
import { GetUserHistoryUseCase } from "./application/use-cases/get-user-history.use-case";
import { ListUsersUseCase } from "./application/use-cases/list-users.use-case";
import { RemoveUserUseCase } from "./application/use-cases/remove-user.use-case";
import { RestoreUserUseCase } from "./application/use-cases/restore-user.use-case";
import { UpdateUserUseCase } from "./application/use-cases/update-user.use-case";
import { UserMapper } from "./infrastructure/persistence/prisma/user.mapper";
import { PrismaUserRepository } from "./infrastructure/persistence/prisma/prisma-user.repository";
import { UsersHttpController } from "./infrastructure/http/users-http.controller";
import { USER_REPOSITORY_PORT } from "./users-context.tokens";

/**
 * Composition root do bounded context de users. Liga o Adapter de
 * persistência no token da Port e instancia os Use Cases + o Adapter HTTP
 * a partir dele. O código da Application depende apenas da Port.
 *
 * Comandos de audit (`softDelete`, `restore`, `update`) exigem um
 * `actorId`. A camada HTTP o passa a partir do principal do JWT; CLI /
 * workers em background que ignoram o Controller devem passá-lo
 * explicitamente.
 */
@Module({
  controllers: [UsersHttpController],
  providers: [
    {
      provide: PrismaUserRepository,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaUserRepository(prisma),
    },
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
    {
      provide: RestoreUserUseCase,
      useFactory: (repo) => new RestoreUserUseCase(repo),
      inject: [USER_REPOSITORY_PORT],
    },
    {
      provide: GetUserHistoryUseCase,
      useFactory: (repo) => new GetUserHistoryUseCase(repo),
      inject: [USER_REPOSITORY_PORT],
    },
  ],
  exports: [USER_REPOSITORY_PORT],
})
export class UsersContextModule {}
