import { describe, expect, it } from "vitest";
import { LoginUseCase } from "./login.use-case";
import { AuthFlowError } from "../../domain/errors/auth-flow.error";
import { FakeAuthApi } from "../testing/fake-auth-api";
import { InMemoryAuthCookieStore } from "../testing/in-memory-auth-cookie-store";
import {
  FakeAuthNavigation,
  captureNavigation,
} from "../testing/fake-auth-navigation";

const build = () => {
  const api = new FakeAuthApi();
  const cookies = new InMemoryAuthCookieStore();
  const navigation = new FakeAuthNavigation();
  return {
    api,
    cookies,
    navigation,
    useCase: new LoginUseCase(api, cookies, navigation),
  };
};

const validInput = { email: "a@b.com", password: "StrongPass1!" };

describe("LoginUseCase", () => {
  it("stores both tokens and navigates to the dashboard on success", async () => {
    const { api, cookies, useCase } = build();
    api.loginResult = { accessToken: "a1", refreshToken: "r1" };

    const navigated = await captureNavigation(() =>
      useCase.execute(validInput),
    );

    expect(navigated).toEqual({ target: "dashboard" });
    expect(cookies.accessToken).toBe("a1");
    expect(cookies.refreshToken).toBe("r1");
    expect(api.loginCalls).toEqual([validInput]);
  });

  it("navigates to login with invalid_input and never calls the api when validation fails", async () => {
    const { api, cookies, useCase } = build();

    const navigated = await captureNavigation(() =>
      useCase.execute({ email: "not-an-email", password: "" }),
    );

    expect(navigated).toEqual({ target: "login", error: "invalid_input" });
    expect(api.loginCalls).toEqual([]);
    expect(cookies.accessToken).toBeUndefined();
  });

  it("surfaces the api message verbatim when the api rejects", async () => {
    const { api, cookies, useCase } = build();
    api.loginResult = new AuthFlowError("creds_bad");

    const navigated = await captureNavigation(() =>
      useCase.execute(validInput),
    );

    expect(navigated).toEqual({ target: "login", error: "creds_bad" });
    expect(cookies.accessToken).toBeUndefined();
  });

  it("falls back to login_failed when the api supplies no message", async () => {
    const { api, useCase } = build();
    api.loginResult = new AuthFlowError();

    const navigated = await captureNavigation(() =>
      useCase.execute(validInput),
    );

    expect(navigated).toEqual({ target: "login", error: "login_failed" });
  });

  it("rethrows non-auth errors instead of navigating", async () => {
    const { navigation, useCase, api } = build();
    api.loginResult = new TypeError("network down");

    await expect(useCase.execute(validInput)).rejects.toThrow("network down");
    expect(navigation.calls).toEqual([]);
  });
});
