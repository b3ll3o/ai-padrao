import { Email } from "./email";

describe("Email", () => {
  it("normalizes a valid email (trim + lowercase)", () => {
    const e = Email.create("  User@Example.COM  ");
    expect(e.value).toBe("user@example.com");
  });

  it("rejects an invalid email", () => {
    expect(() => Email.create("not-an-email")).toThrow(/Invalid email/);
  });

  it("rejects email without a TLD", () => {
    expect(() => Email.create("foo@bar")).toThrow(/Invalid email/);
  });

  it("rejects email with whitespace inside", () => {
    expect(() => Email.create("foo @bar.com")).toThrow(/Invalid email/);
  });

  it("equals compares normalized values", () => {
    expect(Email.create("a@b.com").equals(Email.create("A@B.com"))).toBe(true);
    expect(Email.create("a@b.com").equals(Email.create("c@d.com"))).toBe(false);
  });
});
