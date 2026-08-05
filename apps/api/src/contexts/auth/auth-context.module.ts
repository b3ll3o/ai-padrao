// Provider class names below are consumed at runtime by Nest DI;
// see ADR-002 for the typing constraint.
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Module, type Provider } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { LoginUseCase } from "./application/use-cases/login.use-case";
import { LogoutUseCase } from "./application/use-cases/logout.use-case";
import { RefreshUseCase } from "./application/use-cases/refresh.use-case";
import { RegisterUseCase } from "./application/use-cases/register.use-case";
import { Argon2PasswordHasher } from "./infrastructure/security/argon2-password.hasher";
import { JwtAccessTokenIssuer } from "./infrastructure/security/jwt-access-token.issuer";
import { JwtStrategy } from "./infrastructure/security/jwt.strategy";
import { RandomRefreshTokenGenerator } from "./infrastructure/security/random-refresh-token.generator";
import { Sha256RefreshTokenHasher } from "./infrastructure/security/sha256-refresh-token.hasher";
import { PrismaRefreshTokenStore } from "./infrastructure/persistence/prisma/prisma-refresh-token.store";
import { PrismaUserAuthRepository } from "./infrastructure/persistence/prisma/prisma-user-auth.repository";
import { AuthHttpController } from "./infrastructure/http/auth-http.controller";
import { parseTtlToMs } from "./infrastructure/ttl/parse-ttl";
import {
  ACCESS_TOKEN_ISSUER_PORT,
  AUTH_CONTEXT_CONFIG,
  PASSWORD_HASHER_PORT,
  REFRESH_TOKEN_GENERATOR_PORT,
  REFRESH_TOKEN_HASHER_PORT,
  REFRESH_TOKEN_STORE_PORT,
  USER_AUTH_REPOSITORY_PORT,
} from "./auth-context.tokens";

const portProviders: Provider[] = [
  Argon2PasswordHasher,
  Sha256RefreshTokenHasher,
  RandomRefreshTokenGenerator,
  {
    provide: PrismaUserAuthRepository,
    inject: [PrismaService],
    useFactory: (prisma: PrismaService) => new PrismaUserAuthRepository(prisma),
  },
  {
    provide: PrismaRefreshTokenStore,
    inject: [PrismaService],
    useFactory: (prisma: PrismaService) => new PrismaRefreshTokenStore(prisma),
  },
  { provide: PASSWORD_HASHER_PORT, useExisting: Argon2PasswordHasher },
  { provide: REFRESH_TOKEN_HASHER_PORT, useExisting: Sha256RefreshTokenHasher },
  {
    provide: REFRESH_TOKEN_GENERATOR_PORT,
    useExisting: RandomRefreshTokenGenerator,
  },
  { provide: USER_AUTH_REPOSITORY_PORT, useExisting: PrismaUserAuthRepository },
  { provide: REFRESH_TOKEN_STORE_PORT, useExisting: PrismaRefreshTokenStore },
  {
    provide: ACCESS_TOKEN_ISSUER_PORT,
    inject: [JwtService, ConfigService],
    useFactory: (
      jwt: ConstructorParameters<typeof JwtAccessTokenIssuer>[0],
      config: ConfigService,
    ) =>
      new JwtAccessTokenIssuer(jwt, {
        accessSecret: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      }),
  },
];

const useCaseProviders: Provider[] = [
  {
    provide: RegisterUseCase,
    useFactory: (users, hasher, issuer, generator, tokenHasher, store) =>
      new RegisterUseCase(users, hasher, issuer, generator, tokenHasher, store),
    inject: [
      USER_AUTH_REPOSITORY_PORT,
      PASSWORD_HASHER_PORT,
      ACCESS_TOKEN_ISSUER_PORT,
      REFRESH_TOKEN_GENERATOR_PORT,
      REFRESH_TOKEN_HASHER_PORT,
      REFRESH_TOKEN_STORE_PORT,
    ],
  },
  {
    provide: LoginUseCase,
    useFactory: (users, hasher, issuer, generator, tokenHasher, store) =>
      new LoginUseCase(users, hasher, issuer, generator, tokenHasher, store),
    inject: [
      USER_AUTH_REPOSITORY_PORT,
      PASSWORD_HASHER_PORT,
      ACCESS_TOKEN_ISSUER_PORT,
      REFRESH_TOKEN_GENERATOR_PORT,
      REFRESH_TOKEN_HASHER_PORT,
      REFRESH_TOKEN_STORE_PORT,
    ],
  },
  {
    provide: RefreshUseCase,
    useFactory: (users, issuer, generator, tokenHasher, store) =>
      new RefreshUseCase(users, issuer, generator, tokenHasher, store),
    inject: [
      USER_AUTH_REPOSITORY_PORT,
      ACCESS_TOKEN_ISSUER_PORT,
      REFRESH_TOKEN_GENERATOR_PORT,
      REFRESH_TOKEN_HASHER_PORT,
      REFRESH_TOKEN_STORE_PORT,
    ],
  },
  {
    provide: LogoutUseCase,
    useFactory: (tokenHasher, store) => new LogoutUseCase(tokenHasher, store),
    inject: [REFRESH_TOKEN_HASHER_PORT, REFRESH_TOKEN_STORE_PORT],
  },
];

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        signOptions: {
          expiresIn: (config.get<string>("JWT_ACCESS_TTL") ??
            "15m") as `${number}${"s" | "m" | "h" | "d"}`,
        },
      }),
    }),
  ],
  controllers: [AuthHttpController],
  providers: [
    ...portProviders,
    ...useCaseProviders,
    JwtStrategy,
    JwtAuthGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    {
      provide: AUTH_CONTEXT_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        accessTtl: config.get<string>("JWT_ACCESS_TTL") ?? "15m",
        refreshTtlMs: parseTtlToMs(
          config.get<string>("JWT_REFRESH_TTL") ?? "7d",
        ),
      }),
    },
  ],
  exports: [USER_AUTH_REPOSITORY_PORT],
})
export class AuthContextModule {}
