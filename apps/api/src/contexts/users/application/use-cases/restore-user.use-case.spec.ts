import type { UserHistoryEntry } from "@ai-padrao/contracts";
import { User } from "../../domain/entities/user";
import { UserNotDeletedError } from "../../domain/errors/user-not-deleted.error";
import { UserNotFoundError } from "../../domain/errors/user-not-found.error";
import { InMemoryUserRepository } from "../testing/in-memory-user.repository";
import { RestoreUserUseCase } from "./restore-user.use-case";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");
const deletedAt = new Date("2026-02-01T00:00:00.000Z");

function seedUser(
  id: string,
  version = 0,
  deletedAtValue: Date | null = null,
): User {
  return User.build({
    id,
    email: `${id}@example.com`,
    name: `User ${id}`,
    role: "USER",
    createdAt: fixedDate,
    updatedAt: fixedDate,
    deletedAt: deletedAtValue,
    version,
  });
}

describe("RestoreUserUseCase", () => {
  it("restores a soft-deleted user and clears deletedAt", async () => {
    const repo = new InMemoryUserRepository([seedUser("u1", 1, deletedAt)]);
    const useCase = new RestoreUserUseCase(repo);

    const restored = await useCase.execute("u1", "admin-1");

    expect(restored.id).toBe("u1");
    expect(restored.deletedAt).toBeNull();
    // version increments from the prior state (1) to 2.
    expect(restored.version).toBe(2);
  });

  it("writes a RESTORE entry to history with the actor id", async () => {
    const initial = seedUser("u1", 1, deletedAt);
    const repo = new InMemoryUserRepository([initial]);
    repo.seedCreateHistory(initial);
    const useCase = new RestoreUserUseCase(repo);

    await useCase.execute("u1", "admin-42");

    const history = await repo.getHistory("u1");
    const restoreEntry = history.find(
      (h: UserHistoryEntry) => h.operation === "RESTORE",
    );
    expect(restoreEntry).toBeDefined();
    expect(restoreEntry?.changedBy).toBe("admin-42");
  });

  it("throws UserNotDeletedError when the user is already active", async () => {
    const repo = new InMemoryUserRepository([seedUser("u1", 0, null)]);
    const useCase = new RestoreUserUseCase(repo);

    await expect(useCase.execute("u1", "admin-1")).rejects.toBeInstanceOf(
      UserNotDeletedError,
    );
  });

  it("throws UserNotFoundError for an unknown id", async () => {
    const repo = new InMemoryUserRepository();
    const useCase = new RestoreUserUseCase(repo);

    await expect(useCase.execute("ghost", "admin-1")).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });

  it("does not mutate history when the user is already active (error short-circuits)", async () => {
    const repo = new InMemoryUserRepository([seedUser("u1", 0, null)]);
    const useCase = new RestoreUserUseCase(repo);

    await expect(useCase.execute("u1", "admin-1")).rejects.toBeInstanceOf(
      UserNotDeletedError,
    );

    // No RESTORE entry should have been appended because the call threw.
    const history = await repo.getHistory("u1");
    expect(history.find((h) => h.operation === "RESTORE")).toBeUndefined();
  });

  it("tolerates a missing actorId (system-initiated restore)", async () => {
    const repo = new InMemoryUserRepository([seedUser("u1", 1, deletedAt)]);
    const useCase = new RestoreUserUseCase(repo);

    const restored = await useCase.execute("u1");

    expect(restored.deletedAt).toBeNull();
    const history = await repo.getHistory("u1");
    const restoreEntry = history.find((h) => h.operation === "RESTORE");
    expect(restoreEntry?.changedBy).toBeNull();
  });
});
