import { RegisterInputSchema } from "@ai-padrao/contracts";
import { AuthFlowError } from "../../domain/errors/auth-flow.error";
import type { AuthApiPort } from "../../domain/ports/auth-api.port";
import type { AuthCookieStorePort } from "../../domain/ports/auth-cookie-store.port";
import type { AuthNavigationPort } from "../../domain/ports/auth-navigation.port";

export class RegisterUseCase {
  constructor(
    private readonly api: AuthApiPort,
    private readonly cookies: AuthCookieStorePort,
    private readonly navigation: AuthNavigationPort,
  ) {}

  async execute(input: unknown): Promise<void> {
    const parsed = RegisterInputSchema.safeParse(input);
    if (!parsed.success) return this.navigation.register("invalid_input");

    const result = await this.api
      .register(parsed.data)
      .catch((error: unknown) => {
        if (error instanceof AuthFlowError) return error;
        throw error;
      });

    if (result instanceof AuthFlowError) {
      return this.navigation.register(result.apiMessage ?? "register_failed");
    }

    await this.cookies.setTokens(result);
    return this.navigation.dashboard();
  }
}
