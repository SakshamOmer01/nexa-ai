import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthShell } from "@/components/auth/auth-shell";

// The real AuthNav suspends on the session cookie; the shell only needs the header chrome.
vi.mock("@/components/auth/auth-nav", () => ({
  AuthNav: () => <span>session slot</span>,
}));

function renderShell() {
  return render(
    <AuthShell
      title="Welcome back"
      description="Sign in to reach your workspace."
      footer={<span>No account yet?</span>}
    >
      <p>credential form</p>
    </AuthShell>,
  );
}

describe("AuthShell", () => {
  it("frames the page with the shared header and footer", () => {
    renderShell();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText("session slot")).toBeInTheDocument();
  });

  it("renders the title, description, children and footer slot in the main region", () => {
    renderShell();

    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent("Welcome back");
    expect(within(main).getByText("Sign in to reach your workspace.")).toBeInTheDocument();
    expect(within(main).getByText("credential form")).toBeInTheDocument();
    // The badge is duplicated for mobile and desktop layouts; both sit inside the main landmark.
    expect(within(main).getAllByText("Secure accounts").length).toBeGreaterThan(0);
    expect(within(main).getByText("No account yet?")).toBeInTheDocument();
  });
});
