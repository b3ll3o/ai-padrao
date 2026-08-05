import { describe, expect, it } from "vitest";
import { LogoutUseCase } from "./logout.use-case";
import { FakeAuthApi } from "../testing/fake-auth-api";
import { InMemoryAuthCookieStore } from "../testing/in-memory-auth-cookie-store";
import {
  FakeAuthNavigation,
  captureNavigation,
} from "../testing/fake-auth-navigation";

const build = (initial: { refreshToken?: string } = {}) => {
  const api = new FakeAuthApi();
  const cookies = new InMemoryAuthCookieStore({
    accessToken: "a1",
    ...initial,
  });
  const navigation = new FakeAuthNavigation();
  return {
    api,
    cookies,
    navigation,
    useCase: new LogoutUseCase(api, cookies, navigation),
  };
};

describe("LogoutUseCase", () => {
  it("revokes the refresh token, clears cookies, and navigates to login", async () => {
    const { api, cookies, useCase } = build({ refreshToken: "r3" });

    const navigated = await captureNavigation(() => useCase.execute());

    expect(api.logoutCalls).toEqual(["r3"]);
    expect(cookies.cleared).toBe(1);
    expect(cookies.accessToken).toBeUndefined();
    expect(navigated).toEqual({ target: "login" });
  });

  it("skips the api call but still clears cookies when no refresh token exists", async () => {
    const { api, cookies, useCase } = build();

    const navigated = await captureNavigation(() => useCase.execute());

    expect(api.logoutCalls).toEqual([]);
    expect(cookies.cleared).toBe(1);
    expect(navigated).toEqual({ target: "login" });
  });

  it("still clears cookies and navigates when revoking fails", async () => {
    const { api, cookies, useCase } = build({ refreshToken: "r4" });
    api.logoutResult = new Error("network");

    const navigated = await captureNavigation(() => useCase.execute());

    expect(api.logoutCalls).toEqual(["r4"]);
    expect(cookies.cleared).toBe(1);
    expect(navigated).toEqual({ target: "login" });
  });
});
