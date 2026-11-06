import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/site-footer";
import { siteConfig } from "@/config/site";

describe("SiteFooter", () => {
  it("identifies the product and its version", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(
      screen.getByText(`Monorepo foundation · v${siteConfig.version} · Built for production`),
    ).toBeInTheDocument();
  });

  it("links to the repository, the API reference and the health probe", () => {
    render(<SiteFooter />);

    const repository = screen.getByRole("link", { name: "Repository" });
    // External links leave the app in a new tab without leaking the referrer.
    expect(repository).toHaveAttribute("href", siteConfig.githubUrl);
    expect(repository).toHaveAttribute("target", "_blank");
    expect(repository).toHaveAttribute("rel", "noreferrer");

    expect(screen.getByRole("link", { name: "OpenAPI reference" })).toHaveAttribute(
      "href",
      siteConfig.apiDocsUrl,
    );
    // Same-origin probe stays in the tab so the JSON response is visible.
    expect(screen.getByRole("link", { name: "/api/health" })).toHaveAttribute(
      "href",
      "/api/health",
    );
  });
});
