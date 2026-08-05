import { User } from "../../domain/entities/user";
import { UserNotFoundError } from "../../domain/errors/user-not-found.error";
import { InMemoryUserRepository } from "../testing/in-memory-user.repository";
import { RemoveUserUseCase } from "./remove-user.use-case";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

function user(id: string): User {
  return User.build({
    id,
    email: `${id}@example.com`,
    name: `User ${id}`,
    role: "USER",
    createdAt: fixedDate,
    updatedAt: fixedDate,
    deletedAt: null,
    version: 0,
  });
}

describe("RemoveUserUseCase", () => {
  it("deletes the user and removes it from the repository", async () => {
    const repo = new InMemoryUserRepository([user("u1")]);
    const useCase = new RemoveUserUseCase(repo);

    await useCase.execute("u1");

    expect(await repo.findById("u1")).toBeNull();
  });

  it("throws UserNotFoundError for an unknown id", async () => {
    const repo = new InMemoryUserRepository();
    const useCase = new RemoveUserUseCase(repo);

    await expect(useCase.execute("missing")).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });
});
