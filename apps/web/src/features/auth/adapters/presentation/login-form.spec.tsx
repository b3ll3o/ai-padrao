import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginForm } from "./login-form";

vi.mock("@/lib/auth", () => ({
  loginAction: vi.fn(),
}));

describe("LoginForm", () => {
  it("renders labelled email and password fields", () => {
    render(<LoginForm />);

    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");

    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
  });

  it("renders an enabled submit button", () => {
    render(<LoginForm />);

    const submit = screen.getByRole("button", { name: "Sign in" });
    expect(submit).toBeEnabled();
    expect(submit).toHaveAttribute("type", "submit");
  });

  it("shows the error passed by the page", () => {
    render(<LoginForm error="creds_bad" />);

    expect(screen.getByText("creds_bad")).toBeInTheDocument();
  });

  it("shows no error text when none is supplied", () => {
    render(<LoginForm />);

    expect(screen.queryByText("creds_bad")).not.toBeInTheDocument();
  });
});
