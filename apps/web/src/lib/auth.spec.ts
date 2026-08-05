import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore, redirectMock } = vi.hoisted(() => ({
  cookieStore: {
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
  redirectMock: vi.fn((url: string) => {
    throw new Error(`__redirect:${url}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

const apiUrl = "http://api.localhost:3001";
vi.mock("./env.server", () => ({
  env: {
    API_URL: apiUrl,
    WEB_ORIGIN: "http://localhost:3000",
  },
}));

describe("server actions: loginAction", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    cookieStore.set.mockReset();
    cookieStore.delete.mockReset();
    cookieStore.get.mockReset();
    redirectMock.mockClear();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("redirects to /login?error=invalid_input when Zod validation fails", async () => {
    const { loginAction } = await import("./auth");

    const fd = new FormData();
    fd.set("email", "not-an-email");
    fd.set("password", "");

    try {
      await loginAction(fd);
    } catch (err) {
      expect(String(err)).toContain("/login?error=invalid_input");
    }
    expect(redirectMock).toHaveBeenCalled();
  });

  it("sets cookies and redirects to /dashboard on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: "a1",
          refreshToken: "r1",
          user: { id: "u1" },
        }),
        {
          status: 200,
        },
      ),
    );

    const { loginAction } = await import("./auth");

    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "StrongPass1!");

    try {
      await loginAction(fd);
    } catch (err) {
      expect(String(err)).toContain("/dashboard");
    }

    expect(cookieStore.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "refresh_token", value: "r1" }),
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "access_token", value: "a1" }),
    );
  });

  it("redirects to /login?error=<api-message> on api failure", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "creds_bad" }), { status: 401 }),
      );

    const { loginAction } = await import("./auth");

    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "StrongPass1!");

    try {
      await loginAction(fd);
    } catch (err) {
      expect(String(err)).toContain("creds_bad");
    }
  });

  it("falls back to login_failed when api returns no body", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("not-json", { status: 500 }));

    const { loginAction } = await import("./auth");

    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("password", "StrongPass1!");

    try {
      await loginAction(fd);
    } catch (err) {
      expect(String(err)).toContain("login_failed");
    }
  });
});

describe("server actions: registerAction", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    cookieStore.set.mockReset();
    cookieStore.delete.mockReset();
    cookieStore.get.mockReset();
    redirectMock.mockClear();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("redirects to /register?error=invalid_input when fields missing", async () => {
    const { registerAction } = await import("./auth");

    const fd = new FormData();
    fd.set("email", "a@b.com");
    // missing password and name

    try {
      await registerAction(fd);
    } catch (err) {
      expect(String(err)).toContain("/register?error=invalid_input");
    }
  });

  it("sets cookies and redirects to /dashboard on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: "a2",
          refreshToken: "r2",
          user: { id: "u2" },
        }),
        {
          status: 200,
        },
      ),
    );

    const { registerAction } = await import("./auth");

    const fd = new FormData();
    fd.set("email", "b@b.com");
    fd.set("password", "StrongPass1!");
    fd.set("name", "Bee");

    try {
      await registerAction(fd);
    } catch (err) {
      expect(String(err)).toContain("/dashboard");
    }
  });
});

describe("server actions: logoutAction", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    cookieStore.set.mockReset();
    cookieStore.delete.mockReset();
    cookieStore.get.mockReset();
    redirectMock.mockClear();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls logout endpoint when refresh_token cookie present and clears cookies", async () => {
    cookieStore.get.mockImplementation((name: string) =>
      name === "refresh_token" ? { value: "r3" } : undefined,
    );
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 201 }));

    const { logoutAction } = await import("./auth");

    try {
      await logoutAction();
    } catch (err) {
      expect(String(err)).toContain("/login");
    }

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/logout"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(cookieStore.delete).toHaveBeenCalledWith("refresh_token");
    expect(cookieStore.delete).toHaveBeenCalledWith("access_token");
  });

  it("does not call logout endpoint when refresh_token is missing", async () => {
    cookieStore.get.mockReturnValue(undefined);
    globalThis.fetch = vi.fn();

    const { logoutAction } = await import("./auth");

    try {
      await logoutAction();
    } catch (err) {
      expect(String(err)).toContain("/login");
    }

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(cookieStore.delete).toHaveBeenCalledWith("refresh_token");
  });

  it("still clears cookies when logout endpoint rejects", async () => {
    cookieStore.get.mockImplementation((name: string) =>
      name === "refresh_token" ? { value: "r4" } : undefined,
    );
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network"));

    const { logoutAction } = await import("./auth");

    try {
      await logoutAction();
    } catch (err) {
      expect(String(err)).toContain("/login");
    }

    expect(cookieStore.delete).toHaveBeenCalledWith("refresh_token");
  });
});
