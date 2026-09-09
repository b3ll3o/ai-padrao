// O Nest DI precisa do valor em runtime aqui; `import type` apagaria o
// parâmetro do construtor de design:paramtypes. Casa com a
// convenção usada em jwt.strategy.ts e nos adapters Prisma*.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { JwtService } from "@nestjs/jwt";
import type {
  AccessTokenIssuerPort,
  AccessTokenPayload,
} from "../../domain/ports/access-token-issuer.port";

export interface JwtAccessTokenIssuerConfig {
  accessSecret: string;
}

export class JwtAccessTokenIssuer implements AccessTokenIssuerPort {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: JwtAccessTokenIssuerConfig,
  ) {}

  async sign(payload: AccessTokenPayload, ttl: string): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.accessSecret,
      expiresIn: ttl as `${number}${"s" | "m" | "h" | "d"}`,
    });
  }
}
