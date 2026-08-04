import type { RefreshTokenGeneratorPort } from "../../domain/ports/refresh-token-generator.port";

let counter = 0;

/**
 * Deterministic refresh token generator for tests.
 */
export class FakeRefreshTokenGenerator implements RefreshTokenGeneratorPort {
  constructor(private readonly prefix = "fake-rt") {
    counter = 0;
  }

  generate(): string {
    counter += 1;
    return `${this.prefix}-${counter}`;
  }
}
