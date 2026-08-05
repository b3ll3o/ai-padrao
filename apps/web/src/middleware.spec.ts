import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as NextServer from "next/server";

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof NextServer>("next/server");
  class MockNextResponse {
    status = 200;
    headers: Headers = new Headers();
    cookies = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
    static redirect(url: URL | string, _init?: number | ResponseInit) {
      const r = new MockNextResponse();
      r.headers.set("location", typeof url === "string" ? url : url.toString());
      r.status = 307;
      return r;
    }
    static next() {
      return new MockNextResponse();
    }
  }
  return {
    ...actual,
    NextResponse: MockNextResponse,
  };
});

const buildRequest = (
  pathname: string,
  cookies: Record<string, string> = {},
) => {
  const req = new NextRequest(new URL(`http://localhost${pathname}`));
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
};

describe("middleware", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects to /login when refresh_token cookie is missing on protected path", async () => {
    const req = buildRequest("/dashboard", {});
    const { middleware } = await import("./middleware");
    const res = middleware(req);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("lets through /dashboard when refresh_token is present", async () => {
    const req = buildRequest("/dashboard", { refresh_token: "r1" });
    const { middleware } = await import("./middleware");
    const res = middleware(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects /login to /dashboard when refresh_token cookie is present", async () => {
    const req = buildRequest("/login", { refresh_token: "r1" });
    const { middleware } = await import("./middleware");
    const res = middleware(req);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("lets /login through without refresh_token", async () => {
    const req = buildRequest("/login", {});
    const { middleware } = await import("./middleware");
    const res = middleware(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("treats /register the same as /login", async () => {
    const withCookie = buildRequest("/register", { refresh_token: "r1" });
    const { middleware } = await import("./middleware");
    const res = middleware(withCookie);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("treats subpaths of /login as public", async () => {
    const req = buildRequest("/login/whatever", {});
    const { middleware } = await import("./middleware");
    const res = middleware(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("lets /api/* through even when refresh_token is missing", async () => {
    const req = buildRequest("/api/users", {});
    const { middleware } = await import("./middleware");
    const res = middleware(req);
    expect(res.headers.get("location")).toBeNull();
  });
});
