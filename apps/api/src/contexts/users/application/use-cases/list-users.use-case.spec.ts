import type { UserListQuery } from "@ai-padrao/contracts";
import { User } from "../../domain/entities/user";
import { InMemoryUserRepository } from "../testing/in-memory-user.repository";
import { ListUsersUseCase } from "./list-users.use-case";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

function seed(): User[] {
  return [
    User.build({
      id: "u1",
      email: "alice@example.com",
      name: "Alice",
      role: "USER",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: fixedDate,
      deletedAt: null,
      version: 0,
    }),
    User.build({
      id: "u2",
      email: "bob@example.com",
      name: "Bob",
      role: "USER",
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      updatedAt: fixedDate,
      deletedAt: null,
      version: 0,
    }),
  ];
}

describe("ListUsersUseCase", () => {
  it("returns empty page when repository has no users", async () => {
    const repo = new InMemoryUserRepository();
    const useCase = new ListUsersUseCase(repo);

    const result = await useCase.execute({
      page: 1,
      pageSize: 10,
    } as UserListQuery);

    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 10 });
  });

  it("returns all users when page fits and preserves desc order by createdAt", async () => {
    const older = User.build({
      id: "u1",
      email: "alice@example.com",
      name: "Alice",
      role: "USER",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: fixedDate,
      deletedAt: null,
      version: 0,
    });
    const newer = User.build({
      id: "u2",
      email: "bob@example.com",
      name: "Bob",
      role: "USER",
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      updatedAt: fixedDate,
      deletedAt: null,
      version: 0,
    });
    const repo = new InMemoryUserRepository([older, newer]);
    const useCase = new ListUsersUseCase(repo);

    const result = await useCase.execute({
      page: 1,
      pageSize: 10,
    } as UserListQuery);

    expect(result.total).toBe(2);
    expect(result.items.map((u) => u.id)).toEqual(["u2", "u1"]);
  });

  it("filters by query string case-insensitively across email and name", async () => {
    const repo = new InMemoryUserRepository(seed());
    const useCase = new ListUsersUseCase(repo);

    const result = await useCase.execute({
      page: 1,
      pageSize: 10,
      q: "ALICE",
    } as UserListQuery);

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe("u1");
  });

  it("paginates results using skip = (page - 1) * pageSize", async () => {
    const repo = new InMemoryUserRepository(seed());
    const useCase = new ListUsersUseCase(repo);

    const result = await useCase.execute({
      page: 2,
      pageSize: 1,
    } as UserListQuery);

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("u1");
  });
});
