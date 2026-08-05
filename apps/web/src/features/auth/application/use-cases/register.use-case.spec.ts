import { describe, expect, it } from "vitest";
import { RegisterUseCase } from "./register.use-case";
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
    useCase: new RegisterUseCase(api, cookies, navigation),
  };
};

const validInput = {
  email: "b@b.com",
  password: "StrongPass1!",
  name: "Bee",
};

describe("RegisterUseCase", () => {
  it("stores both tokens and navigates to the dashboard on success", async () => {
    const { api, cookies, useCase } = build();
    api.registerResult = { accessToken: "a2", refreshToken: "r2" };

    const navigated = await captureNavigation(() =>
      useCase.execute(validInput),
    );

    expect(navigated).toEqual({ target: "dashboard" });
    expect(cookies.accessToken).toBe("a2");
    expect(cookies.refreshToken).toBe("r2");
    expect(api.registerCalls).toEqual([validInput]);
  });

  it("navigates to register with invalid_input when required fields are missing", async () => {
    const { api, useCase } = build();

    const navigated = await captureNavigation(() =>
      useCase.execute({ email: "b@b.com", password: "", name: "" }),
    );

    expect(navigated).toEqual({ target: "register", error: "invalid_input" });
    expect(api.registerCalls).toEqual([]);
  });

  it("surfaces the api message verbatim when the api rejects", async () => {
    const { api, useCase } = build();
    api.registerResult = new AuthFlowError("email_taken");

    const navigated = await captureNavigation(() =>
      useCase.execute(validInput),
    );

    expect(navigated).toEqual({ target: "register", error: "email_taken" });
  });

  it("falls back to register_failed when the api supplies no message", async () => {
    const { api, cookies, useCase } = build();
    api.registerResult = new AuthFlowError();

    const navigated = await captureNavigation(() =>
      useCase.execute(validInput),
    );

    expect(navigated).toEqual({ target: "register", error: "register_failed" });
    expect(cookies.refreshToken).toBeUndefined();
  });

  it("rethrows non-auth errors instead of navigating", async () => {
    const { api, navigation, useCase } = build();
    api.registerResult = new TypeError("network down");

    await expect(useCase.execute(validInput)).rejects.toThrow("network down");
    expect(navigation.calls).toEqual([]);
  });
});
