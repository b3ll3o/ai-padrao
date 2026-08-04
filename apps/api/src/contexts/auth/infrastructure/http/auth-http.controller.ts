import {
  ConflictException,
  HttpCode,
  Inject,
  UnauthorizedException,
} from "@nestjs/common";
import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../../../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../../../common/decorators/current-user.decorator";
import { Public } from "../../../../common/decorators/public.decorator";
// Nest DI + emitDecoratorMetadata need the runtime class reference here
// so `design:paramtypes` carries the use-case classes (ADR-002 / INC-003).
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LoginUseCase } from "../../application/use-cases/login.use-case";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LogoutUseCase } from "../../application/use-cases/logout.use-case";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RefreshUseCase } from "../../application/use-cases/refresh.use-case";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RegisterUseCase } from "../../application/use-cases/register.use-case";
import { EmailAlreadyRegisteredError } from "../../domain/errors/email-already-registered.error";
import { InvalidCredentialsError } from "../../domain/errors/invalid-credentials.error";
import type { LoginDto, RefreshDto, RegisterDto } from "./dto/auth.dto";

export const AUTH_CONTEXT_CONFIG = "AUTH_CONTEXT_CONFIG";

export interface AuthContextConfig {
  accessTtl: string;
  refreshTtlMs: number;
}

@ApiTags("auth")
@Controller("auth")
export class AuthHttpController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    @Inject(AUTH_CONTEXT_CONFIG) private readonly config: AuthContextConfig,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post("register")
  async register(@Body() dto: RegisterDto) {
    try {
      return await this.registerUseCase.execute(dto, this.config);
    } catch (err) {
      if (err instanceof EmailAlreadyRegisteredError) {
        throw new ConflictException(err.message);
      }
      throw err;
    }
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  @Post("login")
  async login(@Body() dto: LoginDto) {
    try {
      return await this.loginUseCase.execute(dto, this.config);
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        throw new UnauthorizedException("Invalid credentials");
      }
      throw err;
    }
  }

  @Public()
  @HttpCode(200)
  @Post("refresh")
  async refresh(@Body() dto: RefreshDto) {
    try {
      return await this.refreshUseCase.execute(dto, this.config);
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        throw new UnauthorizedException("Invalid refresh token");
      }
      throw err;
    }
  }

  @Public()
  @HttpCode(204)
  @Post("logout")
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.logoutUseCase.execute(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: { id: string; email: string; role: string }) {
    return user;
  }
}
