import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RegisterForm } from "./register-form";

vi.mock("@/lib/auth", () => ({
  registerAction: vi.fn(),
}));

describe("RegisterForm", () => {
  it("renders labelled name, email and password fields", () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText("Name")).toHaveAttribute(
      "autocomplete",
      "name",
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "new-password");
  });

  it("renders an enabled submit button", () => {
    render(<RegisterForm />);

    const submit = screen.getByRole("button", { name: "Create account" });
    expect(submit).toBeEnabled();
    expect(submit).toHaveAttribute("type", "submit");
  });

  it("shows the error passed by the page", () => {
    render(<RegisterForm error="email_taken" />);

    expect(screen.getByText("email_taken")).toBeInTheDocument();
  });

  it("shows no error text when none is supplied", () => {
    render(<RegisterForm />);

    expect(screen.queryByText("email_taken")).not.toBeInTheDocument();
  });
});
