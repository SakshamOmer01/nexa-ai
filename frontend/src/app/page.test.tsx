import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "@/app/page";

// The header's auth slot and the hero's probe panel are async/fetching server and client widgets
// with their own suites; stubbing them keeps this a test of the page's composition.
vi.mock("@/components/auth/auth-nav", () => ({
  AuthNav: () => <span data-testid="auth-nav">session slot</span>,
}));
vi.mock("@/components/health-status-panel", () => ({
  HealthStatusPanel: () => <div data-testid="health-panel">probe panel</div>,
}));

describe("Home page", () => {
  it("wraps the landing content in the site header and footer", () => {
    render(<Home />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByTestId("auth-nav")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "status");
  });

  it("stacks the hero, stack and architecture sections inside the main landmark", () => {
    render(<Home />);

    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent(
      "built for production",
    );
    expect(within(main).getByRole("heading", { name: "One repository, four clean boundaries" }))
      .toBeInTheDocument();
    expect(
      within(main).getByRole("heading", { name: "A layout that scales past the first feature" }),
    ).toBeInTheDocument();

    // Anchor targets the header nav links to, in document order.
    const ids = [...main.querySelectorAll("section[id]")].map((section) => section.id);
    expect(ids).toEqual(["stack", "architecture"]);
  });
});
