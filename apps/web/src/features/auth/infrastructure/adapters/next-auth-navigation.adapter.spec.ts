import { describe, expect, it, beforeEach, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`__redirect:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

import { NextAuthNavigationAdapter } from "./next-auth-navigation.adapter";

const destinationOf = (run: () => never): string => {
  try {
    run();
  } catch {
    return String(redirectMock.mock.calls.at(-1)?.[0]);
  }
  throw new Error("Expected the adapter to redirect.");
};

describe("NextAuthNavigationAdapter", () => {
  const adapter = new NextAuthNavigationAdapter();

  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("redirects to /dashboard", () => {
    expect(destinationOf(() => adapter.dashboard())).toBe("/dashboard");
  });

  it("redirects to /login without a query string when there is no error", () => {
    expect(destinationOf(() => adapter.login())).toBe("/login");
  });

  it("redirects to /register without a query string when there is no error", () => {
    expect(destinationOf(() => adapter.register())).toBe("/register");
  });

  it("url-encodes the error on the login route", () => {
    expect(destinationOf(() => adapter.login("invalid_input"))).toBe(
      "/login?error=invalid_input",
    );
    expect(destinationOf(() => adapter.login("bad creds & more"))).toBe(
      "/login?error=bad%20creds%20%26%20more",
    );
  });

  it("url-encodes the error on the register route", () => {
    expect(destinationOf(() => adapter.register("register_failed"))).toBe(
      "/register?error=register_failed",
    );
  });

  it("never returns normally", () => {
    expect(() => adapter.dashboard()).toThrow("__redirect:/dashboard");
  });
});
