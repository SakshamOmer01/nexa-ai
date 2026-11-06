import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Architecture } from "@/components/sections/architecture";
import { conventions, repoLayout, roadmap } from "@/config/site";

describe("Architecture", () => {
  it("lists every engineering convention", () => {
    render(<Architecture />);

    expect(
      screen.getByRole("heading", { name: "A layout that scales past the first feature" }),
    ).toBeInTheDocument();
    for (const convention of conventions) {
      expect(screen.getByText(convention)).toBeInTheDocument();
    }
  });

  it("documents each directory in the repository layout", () => {
    const { container } = render(<Architecture />);

    for (const entry of repoLayout) {
      expect(screen.getByText(entry.path)).toBeInTheDocument();
      expect(screen.getByText(entry.description)).toBeInTheDocument();
    }
    // One rule closes the list, and it is decorative rather than semantic.
    expect(container.querySelectorAll('[data-slot="separator"]')).toHaveLength(1);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("separates shipped milestones from planned work", () => {
    render(<Architecture />);

    const shipped = roadmap.filter((item) => item.status === "shipped");
    const planned = roadmap.filter((item) => item.status === "next");

    for (const item of [...shipped, ...planned]) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    }
    // Only shipped entries use the primary text colour; planned ones stay muted.
    expect(screen.getByText(shipped[0].label)).toHaveClass("text-foreground");
    expect(screen.getByText(planned[0].label)).toHaveClass("text-muted-foreground");
  });
});
