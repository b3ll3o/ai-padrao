import { User } from "../../domain/entities/user";
import { UserNotFoundError } from "../../domain/errors/user-not-found.error";
import { InMemoryUserRepository } from "../testing/in-memory-user.repository";
import { FindUserUseCase } from "./find-user.use-case";

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

describe("FindUserUseCase", () => {
  it("returns the user when present", async () => {
    const repo = new InMemoryUserRepository([user("u1")]);
    const useCase = new FindUserUseCase(repo);

    const result = await useCase.execute("u1");

    expect(result.id).toBe("u1");
    expect(result.email.value).toBe("u1@example.com");
  });

  it("throws UserNotFoundError for an unknown id", async () => {
    const repo = new InMemoryUserRepository();
    const useCase = new FindUserUseCase(repo);

    await expect(useCase.execute("missing")).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });
});
