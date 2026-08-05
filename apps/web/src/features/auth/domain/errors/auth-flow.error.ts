/**
 * Raised by `AuthApiPort` implementations when the auth API answers with a
 * non-OK response. `apiMessage` carries the `message` field of the error body
 * when the API supplied one, so the application layer can surface it verbatim
 * and fall back to its own code when it is absent.
 */
export class AuthFlowError extends Error {
  readonly apiMessage?: string;

  constructor(apiMessage?: string) {
    super(apiMessage ?? "auth_flow_failed");
    this.name = "AuthFlowError";
    this.apiMessage = apiMessage;
  }
}
