export class EmailAlreadyRegisteredError extends Error {
  constructor(readonly email: string) {
    super(`Email already registered: ${email}`);
    this.name = "EmailAlreadyRegisteredError";
  }
}
