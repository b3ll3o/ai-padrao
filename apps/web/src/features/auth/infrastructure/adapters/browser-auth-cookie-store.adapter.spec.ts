import { describe, expect, it, beforeEach } from "vitest";
import { BrowserAuthCookieStoreAdapter } from "./browser-auth-cookie-store.adapter";

const setDocumentCookie = (value: string) => {
  Object.defineProperty(document, "cookie", {
    configurable: true,
    writable: true,
    value,
  });
};

describe("BrowserAuthCookieStoreAdapter", () => {
  beforeEach(() => {
    setDocumentCookie("");
  });

  it("reads and url-decodes a token from document.cookie", async () => {
    setDocumentCookie("access_token=eyJ.access; refresh_token=r%201");
    const adapter = new BrowserAuthCookieStoreAdapter({
      isSecure: () => false,
    });

    await expect(adapter.getAccessToken()).resolves.toBe("eyJ.access");
    await expect(adapter.getRefreshToken()).resolves.toBe("r 1");
  });

  it("resolves undefined when the cookie is absent", async () => {
    setDocumentCookie("other=1");
    const adapter = new BrowserAuthCookieStoreAdapter({
      isSecure: () => false,
    });

    await expect(adapter.getAccessToken()).resolves.toBeUndefined();
    await expect(adapter.getRefreshToken()).resolves.toBeUndefined();
  });

  it("writes access then refresh with Path, Max-Age and SameSite", async () => {
    const written: string[] = [];
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: (v: string) => written.push(v),
    });
    const adapter = new BrowserAuthCookieStoreAdapter({
      isSecure: () => false,
    });

    await adapter.setTokens({ accessToken: "a1", refreshToken: "r1" });

    expect(written).toEqual([
      "access_token=a1; Path=/; Max-Age=604800; SameSite=Lax",
      "refresh_token=r1; Path=/; Max-Age=604800; SameSite=Lax",
    ]);
  });

  it("appends Secure when the page is served over https", async () => {
    const written: string[] = [];
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: (v: string) => written.push(v),
    });
    const adapter = new BrowserAuthCookieStoreAdapter({ isSecure: () => true });

    await adapter.setTokens({ accessToken: "a1", refreshToken: "r1" });

    expect(written[0]).toContain("; Secure");
  });

  it("skips empty token values", async () => {
    const written: string[] = [];
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: (v: string) => written.push(v),
    });
    const adapter = new BrowserAuthCookieStoreAdapter({
      isSecure: () => false,
    });

    await adapter.setTokens({ accessToken: "", refreshToken: "r1" });

    expect(written).toHaveLength(1);
    expect(written[0]).toContain("refresh_token=r1");
  });

  it("expires both cookies on clear", async () => {
    const written: string[] = [];
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: (v: string) => written.push(v),
    });
    const adapter = new BrowserAuthCookieStoreAdapter({
      isSecure: () => false,
    });

    await adapter.clearTokens();

    expect(written).toEqual([
      "access_token=; Path=/; Max-Age=0; SameSite=Lax",
      "refresh_token=; Path=/; Max-Age=0; SameSite=Lax",
    ]);
  });
});
