import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/site-footer";
import { siteConfig } from "@/config/site";

describe("SiteFooter", () => {
  it("identifies the product, version and privacy posture", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText(`v${siteConfig.version}`)).toBeInTheDocument();
    expect(
      screen.getByText(/Conversations stay in your browser\. Provider keys stay on the server\./),
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument();
  });

  it("links to the repository, the API reference and the health probe", () => {
    render(<SiteFooter />);

    const repository = screen.getByRole("link", { name: "GitHub repository" });
    // External links leave the app in a new tab without leaking the referrer.
    expect(repository).toHaveAttribute("href", siteConfig.githubUrl);
    expect(repository).toHaveAttribute("target", "_blank");
    expect(repository).toHaveAttribute("rel", "noreferrer");

    expect(screen.getByRole("link", { name: "OpenAPI reference" })).toHaveAttribute(
      "href",
      siteConfig.apiDocsUrl,
    );
    // Same-origin probe stays in the tab so the JSON response is visible.
    expect(screen.getByRole("link", { name: "Service health" })).toHaveAttribute(
      "href",
      "/api/health",
    );
  });

  it("gives workspace and account links real destinations", () => {
    render(<SiteFooter />);

    for (const link of [
      { name: "AI chat", href: "/chat" },
      { name: "Coding assistant", href: "/code" },
      { name: "Documents", href: "/documents" },
      { name: "Data analytics", href: "/analytics" },
      { name: "Sign in", href: "/login" },
      { name: "Create account", href: "/signup" },
      { name: "Settings", href: "/settings" },
      { name: "Profile", href: "/profile" },
    ]) {
      expect(screen.getByRole("link", { name: link.name })).toHaveAttribute("href", link.href);
    }
  });
});
