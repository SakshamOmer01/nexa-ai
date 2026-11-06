import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Hero } from "@/components/sections/hero";
import { siteConfig } from "@/config/site";

// The hero embeds the live probe panel, which fetches on mount; it has its own suite.
vi.mock("@/components/health-status-panel", () => ({
  HealthStatusPanel: () => <div data-testid="health-panel">probe panel</div>,
}));

describe("Hero", () => {
  it("leads with the positioning statement and the shared site description", () => {
    render(<Hero />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "built for production",
    );
    expect(screen.getByText(siteConfig.description)).toBeInTheDocument();
    expect(screen.getByText(`v${siteConfig.version}`)).toBeInTheDocument();
  });

  it("points the calls to action at the API docs and the repository", () => {
    render(<Hero />);

    const api = screen.getByRole("link", { name: /Explore the API/ });
    expect(api).toHaveAttribute("href", siteConfig.apiDocsUrl);
    expect(api).toHaveAttribute("target", "_blank");
    expect(api).toHaveAttribute("rel", "noreferrer");

    const repo = screen.getByRole("link", { name: "Repository" });
    expect(repo).toHaveAttribute("href", siteConfig.githubUrl);
  });

  it("lists the stack highlights next to the probe panel", () => {
    render(<Hero />);

    for (const highlight of ["Next.js 16", "FastAPI", "PostgreSQL 17", "Docker + CI"]) {
      expect(screen.getByText(highlight)).toBeInTheDocument();
    }
    expect(screen.getByTestId("health-panel")).toBeInTheDocument();
    expect(screen.getByText(/Readiness fails with HTTP/)).toBeInTheDocument();
  });
});
