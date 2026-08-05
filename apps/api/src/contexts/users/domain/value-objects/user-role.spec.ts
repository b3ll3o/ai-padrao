import { UserRole } from "./user-role";

describe("UserRole", () => {
  it("exposes User and Admin singletons", () => {
    expect(UserRole.USER.value).toBe("USER");
    expect(UserRole.ADMIN.value).toBe("ADMIN");
  });

  it('from("USER") returns UserRole.USER', () => {
    expect(UserRole.from("USER")).toBe(UserRole.USER);
  });

  it('from("ADMIN") returns UserRole.ADMIN', () => {
    expect(UserRole.from("ADMIN")).toBe(UserRole.ADMIN);
  });

  it('from("unknown") throws with the bad literal', () => {
    expect(() => UserRole.from("GUEST")).toThrow("Invalid role: GUEST");
  });

  it("isAdmin is true only for Admin", () => {
    expect(UserRole.ADMIN.isAdmin()).toBe(true);
    expect(UserRole.USER.isAdmin()).toBe(false);
  });

  it("toString returns the role literal", () => {
    expect(UserRole.ADMIN.toString()).toBe("ADMIN");
    expect(UserRole.USER.toString()).toBe("USER");
  });
});
