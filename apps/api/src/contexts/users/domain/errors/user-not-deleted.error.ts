export class UserNotDeletedError extends Error {
  constructor(readonly userId: string) {
    super(`User ${userId} is not deleted`);
    this.name = "UserNotDeletedError";
  }
}
