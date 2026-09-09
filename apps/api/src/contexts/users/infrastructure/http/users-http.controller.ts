import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { UserDto, UserHistoryEntry } from "@ai-padrao/contracts";
import { JwtAuthGuard } from "../../../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../../../common/decorators/current-user.decorator";
import { UserNotDeletedError } from "../../domain/errors/user-not-deleted.error";
import { UserNotFoundError } from "../../domain/errors/user-not-found.error";
// Nest DI precisa do valor em tempo de execução aqui; `import type` o
// apagaria de design:paramtypes e o Controller quebraria na instanciação.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FindUserUseCase } from "../../application/use-cases/find-user.use-case";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { GetUserHistoryUseCase } from "../../application/use-cases/get-user-history.use-case";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ListUsersUseCase } from "../../application/use-cases/list-users.use-case";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RemoveUserUseCase } from "../../application/use-cases/remove-user.use-case";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RestoreUserUseCase } from "../../application/use-cases/restore-user.use-case";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  UpdateUserUseCase,
  type UpdateUserInput,
} from "../../application/use-cases/update-user.use-case";
import type { UpdateUserDto, UserListQueryDto } from "./dto/users.dto";

/**
 * Shape mínima de `req.user` definido pelo JwtAuthGuard (veja
 * `jwt.strategy.ts`). Mantido local em vez de importado para evitar uma
 * dependência cross-cutting frágil no contexto de auth.
 */
export interface AuthenticatedActor {
  id: string;
  role: "USER" | "ADMIN";
}

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersHttpController {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly findUser: FindUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly removeUser: RemoveUserUseCase,
    private readonly restoreUser: RestoreUserUseCase,
    private readonly getUserHistory: GetUserHistoryUseCase,
  ) {}

  @Get()
  list(@Query() query: UserListQueryDto) {
    return this.listUsers.execute(query);
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<UserDto> {
    try {
      const user = await this.findUser.execute(id);
      return user.toJSON();
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor?: AuthenticatedActor,
  ): Promise<UserDto> {
    try {
      const patch: UpdateUserInput = {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
      };
      const user = await this.updateUser.execute(id, patch, actor?.id);
      return user.toJSON();
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }

  @Delete(":id")
  async remove(
    @Param("id") id: string,
    @CurrentUser() actor?: AuthenticatedActor,
  ): Promise<void> {
    try {
      await this.removeUser.execute(id, actor?.id);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }

  /** Apenas admin: traz um user soft-deleted de volta ao estado ativo. */
  @Patch(":id/restore")
  async restore(
    @Param("id") id: string,
    @CurrentUser() actor?: AuthenticatedActor,
  ): Promise<UserDto> {
    this.requireAdmin(actor);
    try {
      const user = await this.restoreUser.execute(id, actor!.id);
      return user.toJSON();
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        throw new NotFoundException(err.message);
      }
      if (err instanceof UserNotDeletedError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  /** Apenas admin: histórico completo de audit de um user, ordenado por `version` asc. */
  @Get(":id/history")
  async history(
    @Param("id") id: string,
    @CurrentUser() actor?: AuthenticatedActor,
  ): Promise<UserHistoryEntry[]> {
    this.requireAdmin(actor);
    return this.getUserHistory.execute(id);
  }

  private requireAdmin(actor: AuthenticatedActor | undefined): void {
    if (!actor) throw new UnauthorizedException("missing actor");
    if (actor.role !== "ADMIN") {
      throw new ForbiddenException("admin role required");
    }
  }
}
