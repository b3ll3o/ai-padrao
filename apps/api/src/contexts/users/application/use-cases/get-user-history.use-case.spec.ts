import type { UserHistoryEntry } from "@ai-padrao/contracts";
import { Name } from "../../domain/value-objects/name";
import { Email } from "../../domain/value-objects/email";
import { User } from "../../domain/entities/user";
import { InMemoryUserRepository } from "../testing/in-memory-user.repository";
import { GetUserHistoryUseCase } from "./get-user-history.use-case";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

function seedUser(
  id: string,
  version = 0,
  deletedAt: Date | null = null,
): User {
  return User.build({
    id,
    email: `${id}@example.com`,
    name: `User ${id}`,
    role: "USER",
    createdAt: fixedDate,
    updatedAt: fixedDate,
    deletedAt,
    version,
  });
}

describe("GetUserHistoryUseCase", () => {
  it("returns an empty array when the user has no recorded history", async () => {
    const repo = new InMemoryUserRepository([seedUser("u1")]);
    const useCase = new GetUserHistoryUseCase(repo);

    const result = await useCase.execute("u1");

    expect(result).toEqual([]);
  });

  it("returns an empty array for an unknown user id", async () => {
    const repo = new InMemoryUserRepository();
    const useCase = new GetUserHistoryUseCase(repo);

    const result = await useCase.execute("missing");

    expect(result).toEqual([]);
  });

  it("returns history entries ordered by version ascending after mutations", async () => {
    const initial = seedUser("u1", 0);
    const repo = new InMemoryUserRepository([initial]);
    repo.seedCreateHistory(initial);
    await repo.update("u1", { name: "Renamed" }, "actor-1");
    await repo.softDelete("u1", "actor-1");
    await repo.restore("u1", "actor-1");
    const useCase = new GetUserHistoryUseCase(repo);

    const history = await useCase.execute("u1");

    const operations = history.map((h: UserHistoryEntry) => h.operation);
    expect(operations).toEqual(["CREATE", "UPDATE", "DELETE", "RESTORE"]);
    // Versions are monotonic and ascending.
    const versions = history.map((h) => h.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(operations[0]).toBe("CREATE");
    expect(operations.at(-1)).toBe("RESTORE");
  });

  it("records the actor on every mutating entry", async () => {
    const initial = seedUser("u1", 0);
    const repo = new InMemoryUserRepository([initial]);
    repo.seedCreateHistory(initial);
    await repo.update("u1", { name: "Renamed" }, "admin-42");
    await repo.softDelete("u1", "admin-42");
    const useCase = new GetUserHistoryUseCase(repo);

    const history = await useCase.execute("u1");

    // CREATE was seeded without an actor; UPDATE/DELETE must carry it.
    expect(history[0]?.changedBy).toBeNull();
    expect(history.slice(1).map((h) => h.changedBy)).toEqual([
      "admin-42",
      "admin-42",
    ]);
  });

  it("does not touch the entity it returns — history entries are snapshots", async () => {
    const initial = seedUser("u1", 0);
    const repo = new InMemoryUserRepository([initial]);
    repo.seedCreateHistory(initial);
    await repo.update("u1", { name: Name.create("Renamed").value });
    const useCase = new GetUserHistoryUseCase(repo);

    const firstRead = await useCase.execute("u1");
    const secondRead = await useCase.execute("u1");

    expect(firstRead).toEqual(secondRead);
    expect(firstRead[1]?.snapshot).toMatchObject({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: (initial.toJSON() as any).name,
    });
    // The snapshot captured the prior state, not the post-update state.
    expect(firstRead[1]?.snapshot).toMatchObject({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: "User u1" as any,
    });
  });

  it("ignores unknown user ids without throwing", async () => {
    const repo = new InMemoryUserRepository([seedUser("u1")]);
    const useCase = new GetUserHistoryUseCase(repo);

    await expect(useCase.execute("ghost")).resolves.toEqual([]);
  });
});
