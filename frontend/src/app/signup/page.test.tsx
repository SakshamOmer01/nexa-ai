import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SignupPage, { metadata } from "@/app/signup/page";

vi.mock("@/components/auth/auth-form", () => ({
  AuthForm: ({ mode }: { mode: string }) => <form data-testid="auth-form" data-mode={mode} />,
}));
// The real AuthNav suspends on the session cookie; the shell only needs the header chrome.
vi.mock("@/components/auth/auth-nav", () => ({
  AuthNav: () => <span data-testid="auth-nav">session slot</span>,
}));

describe("SignupPage", () => {
  it("renders the registration shell with the form in signup mode", () => {
    render(<SignupPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Create your account");
    expect(screen.getByText(/Passwords are hashed with Argon2id/)).toBeInTheDocument();
    expect(screen.getByTestId("auth-form")).toHaveAttribute("data-mode", "signup");
  });

  it("links existing users back to the sign-in page", () => {
    render(<SignupPage />);

    expect(within(screen.getByRole("main")).getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("publishes page metadata for the sign-up route", () => {
    expect(metadata.title).toBe("Create account");
    expect(metadata.description).toBe("Create a Nexa AI account with an email and password.");
  });
});
