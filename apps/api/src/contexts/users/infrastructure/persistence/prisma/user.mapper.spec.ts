import type { PrismaUserRow } from "./user.mapper";
import { UserMapper } from "./user.mapper";

const baseRow: PrismaUserRow = {
  id: "u1",
  email: "alice@example.com",
  name: "Alice",
  role: "USER",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  deletedAt: null,
  version: 0,
};

describe("UserMapper", () => {
  it("converts a Prisma row into a domain User entity", () => {
    const user = UserMapper.toDomain(baseRow);

    expect(user.id).toBe("u1");
    expect(user.email.value).toBe("alice@example.com");
    expect(user.name.value).toBe("Alice");
    expect(user.role.value).toBe("USER");
    expect(user.createdAt).toEqual(baseRow.createdAt);
    expect(user.updatedAt).toEqual(baseRow.updatedAt);
  });

  it("rejects invalid emails at the value-object boundary", () => {
    expect(() =>
      UserMapper.toDomain({
        ...baseRow,
        email: "not-an-email",
      }),
    ).toThrow(/Invalid email/);
  });

  it("rejects unknown roles at the value-object boundary", () => {
    expect(() =>
      UserMapper.toDomain({
        ...baseRow,
        // @ts-expect-error - exercising the runtime guard for bad data
        role: "ROOT",
      }),
    ).toThrow(/Invalid role/);
  });
});
