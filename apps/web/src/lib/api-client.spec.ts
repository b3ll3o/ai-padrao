import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const baseUrl = "http://api.localhost:3001";

vi.mock("./env.client", () => ({
  env: {
    NEXT_PUBLIC_API_URL: baseUrl,
  },
}));

const setCookie = (value: string) => {
  Object.defineProperty(document, "cookie", {
    configurable: true,
    writable: true,
    value,
  });
};

const clearCookie = () => setCookie("");

describe("apiClient", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    clearCookie();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetModules();
  });

  it("prefixes requests with NEXT_PUBLIC_API_URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    globalThis.fetch = fetchMock;

    const { apiClient } = await import("./api-client");
    await apiClient.get("users").json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledArg = fetchMock.mock.calls[0][0];
    const url =
      typeof calledArg === "string" ? calledArg : (calledArg as Request).url;
    expect(url.startsWith(`${baseUrl}/users`)).toBe(true);
  });

  it("attaches Authorization header when access_token cookie is set", async () => {
    setCookie("access_token=eyJ.access; refresh_token=r1");
    const capturedHeaders: string[] = [];
    const fetchMock = vi.fn().mockImplementation(async (input: unknown) => {
      const req = input instanceof Request ? input : new Request(String(input));
      const auth = req.headers.get("Authorization");
      if (auth) capturedHeaders.push(auth);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    globalThis.fetch = fetchMock;

    const { apiClient } = await import("./api-client");
    await apiClient.get("users").json();

    expect(capturedHeaders).toContain("Bearer eyJ.access");
  });

  it("does not attach Authorization header when no access_token cookie", async () => {
    const capturedHeaders: (string | null)[] = [];
    const fetchMock = vi.fn().mockImplementation(async (input: unknown) => {
      const req = input instanceof Request ? input : new Request(String(input));
      capturedHeaders.push(req.headers.get("Authorization"));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    globalThis.fetch = fetchMock;

    const { apiClient } = await import("./api-client");
    await apiClient.get("users").json();

    expect(capturedHeaders[0]).toBeNull();
  });

  it("refreshes the access token once when receiving 401 and retries the request", async () => {
    setCookie("access_token=expired.access; refresh_token=valid-refresh");

    let firstCall = true;
    const fetchMock = vi.fn().mockImplementation(async (input: unknown) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/api/auth/refresh")) {
        return new Response(
          JSON.stringify({
            accessToken: "rotated.access",
            refreshToken: "rotated.refresh",
          }),
          { status: 200 },
        );
      }
      if (firstCall) {
        firstCall = false;
        return new Response(JSON.stringify({ message: "unauth" }), {
          status: 401,
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    globalThis.fetch = fetchMock;

    const { apiClient } = await import("./api-client");
    const result = await apiClient.get("users").json();

    expect((result as { ok: boolean }).ok).toBe(true);

    const refreshCalls = fetchMock.mock.calls.filter(([u]) =>
      String(typeof u === "string" ? u : (u as Request).url).endsWith(
        "/api/auth/refresh",
      ),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("returns the original 401 response when refresh fails", async () => {
    setCookie("access_token=expired.access; refresh_token=bad");

    const fetchMock = vi.fn().mockImplementation(async (input: unknown) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/api/auth/refresh")) {
        return new Response(JSON.stringify({ message: "no" }), { status: 401 });
      }
      return new Response(JSON.stringify({ message: "unauth" }), {
        status: 401,
      });
    });
    globalThis.fetch = fetchMock;

    const { apiClient } = await import("./api-client");

    await expect(apiClient.get("users").json()).rejects.toThrow();

    const refreshCalls = fetchMock.mock.calls.filter(([u]) =>
      String(typeof u === "string" ? u : (u as Request).url).endsWith(
        "/api/auth/refresh",
      ),
    );
    expect(refreshCalls).toHaveLength(1);
  });
});
