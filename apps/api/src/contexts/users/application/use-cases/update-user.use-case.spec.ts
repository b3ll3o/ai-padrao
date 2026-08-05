import { User } from "../../domain/entities/user";
import { UserNotFoundError } from "../../domain/errors/user-not-found.error";
import { InMemoryUserRepository } from "../testing/in-memory-user.repository";
import { UpdateUserUseCase } from "./update-user.use-case";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

function user(id: string, name: string, email: string): User {
  return User.build({
    id,
    name,
    email,
    role: "USER",
    createdAt: fixedDate,
    updatedAt: fixedDate,
  });
}

describe("UpdateUserUseCase", () => {
  it("updates name and email returning a new instance", async () => {
    const repo = new InMemoryUserRepository([
      user("u1", "Alice", "alice@example.com"),
    ]);
    const useCase = new UpdateUserUseCase(repo);

    const updated = await useCase.execute("u1", {
      name: "Alice Updated",
      email: "alice+new@example.com",
    });

    expect(updated.name.value).toBe("Alice Updated");
    expect(updated.email.value).toBe("alice+new@example.com");
    const reloaded = await repo.findById("u1");
    expect(reloaded?.name.value).toBe("Alice Updated");
    expect(reloaded?.email.value).toBe("alice+new@example.com");
  });

  it("updates only the fields provided", async () => {
    const repo = new InMemoryUserRepository([
      user("u1", "Alice", "alice@example.com"),
    ]);
    const useCase = new UpdateUserUseCase(repo);

    const updated = await useCase.execute("u1", { name: "Alice Two" });

    expect(updated.name.value).toBe("Alice Two");
    expect(updated.email.value).toBe("alice@example.com");
  });

  it("throws UserNotFoundError for an unknown id", async () => {
    const repo = new InMemoryUserRepository();
    const useCase = new UpdateUserUseCase(repo);

    await expect(
      useCase.execute("missing", { name: "Anything" }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
