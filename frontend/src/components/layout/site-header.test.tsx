import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SiteHeader } from "@/components/layout/site-header";
import { siteConfig } from "@/config/site";

// AuthNav is an async server component that reads the session cookie; a stub keeps the header
// testable in the browser renderer, which cannot await server components.
vi.mock("@/components/auth/auth-nav", () => ({
  AuthNav: () => <span data-testid="auth-nav">session slot</span>,
}));

describe("SiteHeader", () => {
  it("renders the original brand and every configured nav link", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    const home = screen.getByRole("link", { name: `${siteConfig.name} home` });
    expect(home).toHaveAttribute("href", "/");
    expect(screen.getByLabelText("Nexa AI")).toBeInTheDocument();

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    for (const item of siteConfig.nav) {
      expect(within(primaryNav).getByRole("link", { name: item.label })).toHaveAttribute(
        "href",
        item.href,
      );
    }
  });

  it("renders the auth slot, theme control and mobile navigation", () => {
    render(<SiteHeader />);

    expect(screen.getByTestId("auth-nav")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Switch to dark mode/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open navigation" })).toBeInTheDocument();
  });

  it("opens the API docs in a new tab without a referrer", () => {
    render(<SiteHeader />);

    const apiDocs = screen.getByRole("link", { name: "API docs" });
    expect(apiDocs).toHaveAttribute("href", siteConfig.apiDocsUrl);
    expect(apiDocs).toHaveAttribute("target", "_blank");
    expect(apiDocs).toHaveAttribute("rel", "noreferrer");
  });
});
