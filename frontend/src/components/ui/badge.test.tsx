import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("defaults to the primary variant and exposes it as a data attribute", () => {
    render(<Badge>beta</Badge>);

    const badge = screen.getByText("beta");
    expect(badge).toHaveAttribute("data-slot", "badge");
    expect(badge).toHaveAttribute("data-variant", "default");
    expect(badge).toHaveClass("bg-primary");
  });

  it("applies the classes of the requested variant", () => {
    render(<Badge variant="outline">v0.1.0</Badge>);

    expect(screen.getByText("v0.1.0")).toHaveAttribute("data-variant", "outline");
    expect(screen.getByText("v0.1.0")).toHaveClass("border-border");
  });

  it("renders the child element when asChild is set", () => {
    render(
      <Badge asChild variant="secondary">
        <a href="/changelog">changelog</a>
      </Badge>,
    );

    // The link keeps its own semantics instead of being wrapped in a span.
    const link = screen.getByRole("link", { name: "changelog" });
    expect(link).toHaveAttribute("data-slot", "badge");
    expect(link).toHaveAttribute("href", "/changelog");
  });
});
