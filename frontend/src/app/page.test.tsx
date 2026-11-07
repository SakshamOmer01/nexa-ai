import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "@/app/page";

// The header's auth slot and the live probe panel are async/fetching widgets with their own
// suites; stubbing them keeps this a test of the page's composition.
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
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("stacks the product story from hero to closing call to action", () => {
    render(<Home />);

    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent(
      "everything you ask AI",
    );
    expect(within(main).getByRole("heading", { name: "From a blank page to a finished answer" }))
      .toBeInTheDocument();
    expect(within(main).getByRole("heading", { name: "Everything in one place, nothing in the way" }))
      .toBeInTheDocument();
    expect(within(main).getByRole("heading", { name: "Your work is not the product" }))
      .toBeInTheDocument();
    expect(within(main).getByRole("heading", { name: "One repository, four clean boundaries" }))
      .toBeInTheDocument();
    expect(
      within(main).getByRole("heading", { name: "A layout that scales past the first feature" }),
    ).toBeInTheDocument();
    expect(within(main).getByRole("heading", { name: "Boring infrastructure, on purpose" }))
      .toBeInTheDocument();
    expect(within(main).getByRole("heading", { name: "Make room for the work that matters" }))
      .toBeInTheDocument();
    expect(screen.getByTestId("health-panel")).toBeInTheDocument();
  });

  it("gives every anchor target in the primary navigation a real section", () => {
    render(<Home />);

    const ids = [...screen.getByRole("main").querySelectorAll("section[id]")].map(
      (section) => section.id,
    );
    expect(ids).toEqual(["product", "capabilities", "stack", "architecture", "status"]);
  });
});
