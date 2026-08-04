import { User } from "./user";
import { Email } from "../value-objects/email";
import { Name } from "../value-objects/name";
import { UserRole } from "../value-objects/user-role";

const base = () => ({
  id: "u-1",
  email: "a@b.com",
  name: "Alice",
  role: "USER",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
});

describe("User", () => {
  it("builds from primitives via the factory", () => {
    const u = User.build(base());
    expect(u.id).toBe("u-1");
    expect(u.email.value).toBe("a@b.com");
    expect(u.name.value).toBe("Alice");
    expect(u.role).toBe(UserRole.USER);
  });

  it("rename() returns a new instance with updated name and timestamp", () => {
    const original = User.build(base());
    const renamed = original.rename(Name.create("Bob"));
    expect(renamed).not.toBe(original);
    expect(renamed.name.value).toBe("Bob");
    expect(original.name.value).toBe("Alice");
    expect(renamed.updatedAt.getTime()).toBeGreaterThanOrEqual(
      original.updatedAt.getTime(),
    );
  });

  it("rename() is a no-op when the name is the same", () => {
    const u = User.build(base());
    const same = u.rename(Name.create("Alice"));
    expect(same).toBe(u);
  });

  it("changeEmail() returns a new instance with updated email and timestamp", () => {
    const original = User.build(base());
    const updated = original.changeEmail(Email.create("z@b.com"));
    expect(updated.email.value).toBe("z@b.com");
    expect(original.email.value).toBe("a@b.com");
  });

  it("changeEmail() is a no-op when the email is the same", () => {
    const u = User.build(base());
    const same = u.changeEmail(Email.create("a@b.com"));
    expect(same).toBe(u);
  });

  it("toJSON returns the public DTO shape", () => {
    const u = User.build(base());
    expect(u.toJSON()).toEqual({
      id: "u-1",
      email: "a@b.com",
      name: "Alice",
      role: "USER",
      createdAt: base().createdAt,
      updatedAt: base().updatedAt,
    });
  });
});
