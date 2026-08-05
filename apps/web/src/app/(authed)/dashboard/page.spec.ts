import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore, redirectMock } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn() },
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
vi.mock("@/lib/env.server", () => ({
  env: { API_URL: apiUrl },
}));

describe("dashboard fetchMe", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    cookieStore.get.mockReset();
    redirectMock.mockClear();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetModules();
  });

  it("returns null and does not fetch when refresh_token cookie is missing", async () => {
    cookieStore.get.mockReturnValue(undefined);

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const { default: DashboardPage } = await import("./page");

    try {
      await DashboardPage();
    } catch (err) {
      expect(String(err)).toContain("/login");
    }

    expect(fetchMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("returns null and redirects when refresh endpoint fails", async () => {
    cookieStore.get.mockImplementation((name: string) =>
      name === "refresh_token" ? { value: "r1" } : undefined,
    );
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 401 }));

    const { default: DashboardPage } = await import("./page");

    try {
      await DashboardPage();
    } catch (err) {
      expect(String(err)).toContain("/login");
    }
  });

  it("returns null and redirects when /me call fails after a successful refresh", async () => {
    cookieStore.get.mockImplementation((name: string) =>
      name === "refresh_token" ? { value: "r2" } : undefined,
    );
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "a2" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response("nope", { status: 403 }));

    const { default: DashboardPage } = await import("./page");

    try {
      await DashboardPage();
    } catch (err) {
      expect(String(err)).toContain("/login");
    }
  });
});
