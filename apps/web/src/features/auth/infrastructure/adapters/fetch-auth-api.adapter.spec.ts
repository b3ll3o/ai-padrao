import { describe, expect, it, beforeEach, vi } from "vitest";
import { FetchAuthApiAdapter } from "./fetch-auth-api.adapter";
import { AuthFlowError } from "../../domain/errors/auth-flow.error";

const baseUrl = "http://api.localhost:3001";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("FetchAuthApiAdapter", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let adapter: FetchAuthApiAdapter;

  beforeEach(() => {
    fetchMock = vi.fn();
    adapter = new FetchAuthApiAdapter(
      baseUrl,
      fetchMock as unknown as typeof fetch,
    );
  });

  it("POSTs login credentials as JSON and returns the tokens", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ accessToken: "a1", refreshToken: "r1" }),
    );

    await expect(
      adapter.login({ email: "a@b.com", password: "pw" }),
    ).resolves.toEqual({ accessToken: "a1", refreshToken: "r1" });

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "pw" }),
    });
  });

  it("throws AuthFlowError carrying the api message when login is rejected", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "creds_bad" }, 401));

    await expect(
      adapter.login({ email: "a@b.com", password: "pw" }),
    ).rejects.toMatchObject({
      name: "AuthFlowError",
      apiMessage: "creds_bad",
    });
  });

  it("throws AuthFlowError without a message when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("not-json", { status: 500 }));

    const error = await adapter
      .login({ email: "a@b.com", password: "pw" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AuthFlowError);
    expect((error as AuthFlowError).apiMessage).toBeUndefined();
  });

  it("POSTs register credentials as JSON and returns the tokens", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ accessToken: "a2", refreshToken: "r2" }),
    );

    await expect(
      adapter.register({ email: "b@b.com", password: "pw", name: "Bee" }),
    ).resolves.toEqual({ accessToken: "a2", refreshToken: "r2" });

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "b@b.com", password: "pw", name: "Bee" }),
    });
  });

  it("throws AuthFlowError carrying the api message when register is rejected", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "email_taken" }, 409));

    await expect(
      adapter.register({ email: "b@b.com", password: "pw", name: "Bee" }),
    ).rejects.toMatchObject({ apiMessage: "email_taken" });
  });

  it("sends the refresh token with credentials included and returns rotated tokens", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ accessToken: "a3", refreshToken: "r3" }),
    );

    await expect(adapter.refresh("r-old")).resolves.toEqual({
      accessToken: "a3",
      refreshToken: "r3",
    });

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "r-old" }),
      credentials: "include",
    });
  });

  it("resolves null when refresh is rejected", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "no" }, 401));

    await expect(adapter.refresh("stale")).resolves.toBeNull();
  });

  it("normalises missing tokens in a refresh response to empty strings", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ refreshToken: "r4" }));

    await expect(adapter.refresh("r-old")).resolves.toEqual({
      accessToken: "",
      refreshToken: "r4",
    });
  });

  it("POSTs the refresh token on logout and ignores the response status", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    await expect(adapter.logout("r5")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "r5" }),
    });
  });
});
