import { describe, expect, it } from "vitest";
import { decideRouteAccess, isPublicPath } from "./route-access.policy";

describe("isPublicPath", () => {
  it.each(["/login", "/register", "/login/whatever", "/register/step-2"])(
    "treats %s as public",
    (pathname) => {
      expect(isPublicPath(pathname)).toBe(true);
    },
  );

  it.each(["/dashboard", "/", "/loginx", "/api/users"])(
    "treats %s as protected",
    (pathname) => {
      expect(isPublicPath(pathname)).toBe(false);
    },
  );
});

describe("decideRouteAccess", () => {
  it("sends a signed-in visitor away from a public path to the dashboard", () => {
    expect(
      decideRouteAccess({ pathname: "/login", hasRefreshToken: true }),
    ).toEqual({ type: "redirect", to: "/dashboard" });
    expect(
      decideRouteAccess({ pathname: "/register", hasRefreshToken: true }),
    ).toEqual({ type: "redirect", to: "/dashboard" });
  });

  it("allows an anonymous visitor onto a public path", () => {
    expect(
      decideRouteAccess({ pathname: "/login", hasRefreshToken: false }),
    ).toEqual({ type: "allow" });
  });

  it("sends an anonymous visitor on a protected path to login", () => {
    expect(
      decideRouteAccess({ pathname: "/dashboard", hasRefreshToken: false }),
    ).toEqual({ type: "redirect", to: "/login" });
  });

  it("allows a signed-in visitor onto a protected path", () => {
    expect(
      decideRouteAccess({ pathname: "/dashboard", hasRefreshToken: true }),
    ).toEqual({ type: "allow" });
  });

  it("never redirects api routes, so they can answer 401 themselves", () => {
    expect(
      decideRouteAccess({ pathname: "/api/users", hasRefreshToken: false }),
    ).toEqual({ type: "allow" });
  });
});
