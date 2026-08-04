import { describe, expect, it } from "vitest";
import { RefreshSessionUseCase } from "./refresh-session.use-case";
import { FakeAuthApi } from "../testing/fake-auth-api";
import { InMemoryAuthCookieStore } from "../testing/in-memory-auth-cookie-store";

const build = (initial: { refreshToken?: string } = {}) => {
  const api = new FakeAuthApi();
  const cookies = new InMemoryAuthCookieStore(initial);
  return { api, cookies, useCase: new RefreshSessionUseCase(api, cookies) };
};

describe("RefreshSessionUseCase", () => {
  it("rotates both cookies and returns the new access token", async () => {
    const { api, cookies, useCase } = build({ refreshToken: "r1" });
    api.refreshResult = { accessToken: "rotated.a", refreshToken: "rotated.r" };

    await expect(useCase.execute()).resolves.toBe("rotated.a");

    expect(api.refreshCalls).toEqual(["r1"]);
    expect(cookies.accessToken).toBe("rotated.a");
    expect(cookies.refreshToken).toBe("rotated.r");
  });

  it("returns null without calling the api when there is no refresh cookie", async () => {
    const { api, useCase } = build();

    await expect(useCase.execute()).resolves.toBeNull();
    expect(api.refreshCalls).toEqual([]);
  });

  it("returns null and leaves cookies untouched when the api rejects the token", async () => {
    const { api, cookies, useCase } = build({ refreshToken: "stale" });
    api.refreshResult = null;

    await expect(useCase.execute()).resolves.toBeNull();

    expect(api.refreshCalls).toEqual(["stale"]);
    expect(cookies.accessToken).toBeUndefined();
    expect(cookies.refreshToken).toBe("stale");
  });

  it("writes only the tokens the api actually returned", async () => {
    const { api, cookies, useCase } = build({
      refreshToken: "r1",
    });
    api.refreshResult = { accessToken: "", refreshToken: "rotated.r" };

    await expect(useCase.execute()).resolves.toBeNull();

    expect(cookies.accessToken).toBeUndefined();
    expect(cookies.refreshToken).toBe("rotated.r");
  });
});
