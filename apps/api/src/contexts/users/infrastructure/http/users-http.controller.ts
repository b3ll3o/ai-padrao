import { NotFoundException } from "@nestjs/common";
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
import type { UserDto } from "@ai-padrao/contracts";
import { JwtAuthGuard } from "../../../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../../../common/decorators/current-user.decorator";
import { UserNotFoundError } from "../../domain/errors/user-not-found.error";
import type { FindUserUseCase } from "../../application/use-cases/find-user.use-case";
import type { ListUsersUseCase } from "../../application/use-cases/list-users.use-case";
import type { RemoveUserUseCase } from "../../application/use-cases/remove-user.use-case";
import type {
  UpdateUserUseCase,
  UpdateUserInput,
} from "../../application/use-cases/update-user.use-case";
import type { UpdateUserDto, UserListQueryDto } from "./dto/users.dto";

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
  ): Promise<UserDto> {
    try {
      const patch: UpdateUserInput = {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
      };
      const user = await this.updateUser.execute(id, patch);
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
    @CurrentUser() _user: unknown,
  ): Promise<void> {
    try {
      await this.removeUser.execute(id);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }
}
