import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DashboardPage, { metadata } from "@/app/dashboard/page";

vi.mock("@/components/auth/auth-nav", () => ({
  AuthNav: () => <span data-testid="auth-nav">session slot</span>,
}));
// The body is an async server component, which the browser renderer cannot mount. Suspending on a
// pending promise keeps the fallback on screen, which is what the server streams first anyway.
// DashboardContent has its own suite.
vi.mock("@/app/dashboard/dashboard-content", () => ({
  DashboardContent: () => {
    throw new Promise(() => {});
  },
}));

async function renderPage() {
  // Let the Suspense boundary settle so React does not warn about acting on a suspended tree.
  await act(async () => {
    render(<DashboardPage />);
  });
}

describe("DashboardPage", () => {
  it("renders the shell with the page chrome around the dashboard body", async () => {
    await renderPage();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByTestId("auth-nav")).toBeInTheDocument();
  });

  it("streams the loading skeleton until the session resolves", async () => {
    await renderPage();

    const main = screen.getByRole("main");
    const skeleton = main.querySelector('[aria-busy="true"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton).toHaveAttribute("aria-live", "polite");
    // The skeleton is presentational only: no account details leak before the session is known.
    expect(within(main).queryByRole("heading")).not.toBeInTheDocument();
  });

  it("publishes page metadata for the dashboard route", () => {
    expect(metadata.title).toBe("Dashboard");
    expect(metadata.description).toBe("Your authenticated Nexa AI account.");
  });
});
