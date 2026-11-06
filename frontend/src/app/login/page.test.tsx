import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LoginPage, { metadata } from "@/app/login/page";

// AuthForm owns the submit flow (and needs an app-router context); here we assert the page wires it
// up in login mode.
vi.mock("@/components/auth/auth-form", () => ({
  AuthForm: ({ mode }: { mode: string }) => <form data-testid="auth-form" data-mode={mode} />,
}));
// The real AuthNav suspends on the session cookie; the shell only needs the header chrome.
vi.mock("@/components/auth/auth-nav", () => ({
  AuthNav: () => <span data-testid="auth-nav">session slot</span>,
}));

describe("LoginPage", () => {
  it("renders the sign-in shell with the form in login mode", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome back");
    expect(screen.getByText(/Sign in with your email and password/)).toBeInTheDocument();
    expect(screen.getByTestId("auth-form")).toHaveAttribute("data-mode", "login");
  });

  it("links visitors without an account to the sign-up page", () => {
    render(<LoginPage />);

    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/signup",
    );
  });

  it("publishes page metadata for the sign-in route", () => {
    expect(metadata.title).toBe("Sign in");
    expect(metadata.description).toBe("Sign in to your Nexa AI account.");
  });
});
