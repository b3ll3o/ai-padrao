import { describe, expect, it, beforeEach, vi } from "vitest";

const { cookieStore } = vi.hoisted(() => ({
  cookieStore: { set: vi.fn(), delete: vi.fn(), get: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

import { NextAuthCookieStoreAdapter } from "./next-auth-cookie-store.adapter";

describe("NextAuthCookieStoreAdapter", () => {
  beforeEach(() => {
    cookieStore.set.mockReset();
    cookieStore.delete.mockReset();
    cookieStore.get.mockReset();
  });

  it("reads the access and refresh token cookies by name", async () => {
    cookieStore.get.mockImplementation((name: string) =>
      name === "access_token" ? { value: "a1" } : { value: "r1" },
    );
    const adapter = new NextAuthCookieStoreAdapter({ secure: false });

    await expect(adapter.getAccessToken()).resolves.toBe("a1");
    await expect(adapter.getRefreshToken()).resolves.toBe("r1");
  });

  it("resolves undefined when a cookie is absent", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const adapter = new NextAuthCookieStoreAdapter({ secure: false });

    await expect(adapter.getAccessToken()).resolves.toBeUndefined();
    await expect(adapter.getRefreshToken()).resolves.toBeUndefined();
  });

  it("writes refresh then access with the established cookie options", async () => {
    const adapter = new NextAuthCookieStoreAdapter({ secure: false });

    await adapter.setTokens({ accessToken: "a1", refreshToken: "r1" });

    expect(cookieStore.set).toHaveBeenNthCalledWith(1, {
      name: "refresh_token",
      value: "r1",
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    expect(cookieStore.set).toHaveBeenNthCalledWith(2, {
      name: "access_token",
      value: "a1",
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  });

  it("marks cookies secure when configured for https", async () => {
    const adapter = new NextAuthCookieStoreAdapter({ secure: true });

    await adapter.setTokens({ accessToken: "a1", refreshToken: "r1" });

    expect(cookieStore.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "refresh_token", secure: true }),
    );
  });

  it("skips empty token values instead of overwriting a good cookie", async () => {
    const adapter = new NextAuthCookieStoreAdapter({ secure: false });

    await adapter.setTokens({ accessToken: "", refreshToken: "r1" });

    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    expect(cookieStore.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "refresh_token" }),
    );
  });

  it("deletes both cookies on clear", async () => {
    const adapter = new NextAuthCookieStoreAdapter({ secure: false });

    await adapter.clearTokens();

    expect(cookieStore.delete).toHaveBeenNthCalledWith(1, "refresh_token");
    expect(cookieStore.delete).toHaveBeenNthCalledWith(2, "access_token");
  });
});
