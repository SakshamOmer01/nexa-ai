import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Separator } from "@/components/ui/separator";

describe("Separator", () => {
  it("stays out of the accessibility tree by default", () => {
    const { container } = render(<Separator />);

    // Purely visual rules should not be announced by screen readers.
    expect(container.querySelector('[data-slot="separator"]')).toHaveAttribute(
      "data-orientation",
      "horizontal",
    );
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("is announced when it carries meaning", () => {
    render(<Separator decorative={false} orientation="vertical" />);

    const separator = screen.getByRole("separator");
    expect(separator).toHaveAttribute("data-orientation", "vertical");
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
  });
});
