import { LoginDto, RefreshDto, RegisterDto } from "./auth.dto";
import {
  LoginInputSchema,
  RefreshInputSchema,
  RegisterInputSchema,
} from "@ai-padrao/contracts";

describe("AuthDto", () => {
  it("RegisterDto is defined as a class", () => {
    expect(RegisterDto).toBeDefined();
    expect(typeof RegisterDto).toBe("function");
  });

  it("RegisterInputSchema validates a well-formed payload", () => {
    const valid = RegisterInputSchema.parse({
      email: "a@b.com",
      name: "Alice",
      password: "StrongPass1!",
    });
    expect(valid.email).toBe("a@b.com");
    expect(valid.password).toBe("StrongPass1!");
    expect(valid.name).toBe("Alice");
  });

  it("RegisterInputSchema rejects weak passwords", () => {
    expect(() =>
      RegisterInputSchema.parse({
        email: "a@b.com",
        name: "Alice",
        password: "short",
      }),
    ).toThrow();
    expect(() =>
      RegisterInputSchema.parse({
        email: "a@b.com",
        name: "Alice",
        password: "alllowercase1",
      }),
    ).toThrow();
    expect(() =>
      RegisterInputSchema.parse({
        email: "a@b.com",
        name: "Alice",
        password: "NoDigits!",
      }),
    ).toThrow();
  });

  it("LoginDto is defined", () => {
    expect(LoginDto).toBeDefined();
    expect(typeof LoginDto).toBe("function");
  });

  it("LoginInputSchema requires a valid email + non-empty password", () => {
    expect(() =>
      LoginInputSchema.parse({ email: "not-an-email", password: "x" }),
    ).toThrow();
    expect(() =>
      LoginInputSchema.parse({ email: "a@b.com", password: "" }),
    ).toThrow();
    const ok = LoginInputSchema.parse({ email: "a@b.com", password: "x" });
    expect(ok.password).toBe("x");
  });

  it("RefreshDto is defined", () => {
    expect(RefreshDto).toBeDefined();
    expect(typeof RefreshDto).toBe("function");
  });

  it("RefreshInputSchema requires a non-empty refresh token", () => {
    expect(() => RefreshInputSchema.parse({ refreshToken: "" })).toThrow();
    const ok = RefreshInputSchema.parse({ refreshToken: "opaque-token" });
    expect(ok.refreshToken).toBe("opaque-token");
  });
});
