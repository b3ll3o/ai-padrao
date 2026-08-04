import { Name } from "./name";

describe("Name", () => {
  it("trims surrounding whitespace", () => {
    expect(Name.create("  Alice  ").value).toBe("Alice");
  });

  it("rejects empty after trim", () => {
    expect(() => Name.create("   ")).toThrow(/Name must not be empty/);
  });

  it("rejects names longer than 120 characters", () => {
    expect(() => Name.create("a".repeat(121))).toThrow(
      /Name must be at most 120/,
    );
  });

  it("accepts exactly 120 characters", () => {
    expect(Name.create("a".repeat(120)).value).toHaveLength(120);
  });

  it("equals compares by value", () => {
    expect(Name.create("a").equals(Name.create("a"))).toBe(true);
    expect(Name.create("a").equals(Name.create("b"))).toBe(false);
  });
});
