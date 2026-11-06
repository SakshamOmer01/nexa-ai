import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stack } from "@/components/sections/stack";
import { platformStack } from "@/config/site";

describe("Stack", () => {
  it("renders one card per configured layer", () => {
    render(<Stack />);

    expect(
      screen.getByRole("heading", { name: "One repository, four clean boundaries" }),
    ).toBeInTheDocument();

    for (const item of platformStack) {
      // CardTitle renders a styled div, so match on text rather than a heading role.
      expect(screen.getByText(item.title)).toHaveAttribute("data-slot", "card-title");
      expect(screen.getByText(item.description)).toBeInTheDocument();
    }
  });

  it("shows each layer's tags", () => {
    render(<Stack />);

    const tags = platformStack.flatMap((item) => item.tags);
    // Tags repeat across layers, so assert presence rather than a unique node.
    for (const tag of new Set(tags)) {
      expect(screen.getAllByText(tag).length).toBeGreaterThan(0);
    }
  });
});
