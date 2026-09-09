// Nest DI needs the runtime value here; `import type` would erase the
// constructor parameter from design:paramtypes. Matches the
// convention used in jwt.strategy.ts and the Prisma* adapters.
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
