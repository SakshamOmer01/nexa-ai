import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

describe("Card", () => {
  it("renders every slot with its styling hook", () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Repository layout</CardTitle>
          <CardDescription>Where each layer lives</CardDescription>
          <CardAction>
            <button type="button">copy</button>
          </CardAction>
        </CardHeader>
        <CardContent>body</CardContent>
        <CardFooter>footer</CardFooter>
      </Card>,
    );

    // `data-slot` is what the container queries and spacing rules target.
    expect(container.querySelector('[data-slot="card"]')).toBeInTheDocument();
    for (const slot of ["card-header", "card-title", "card-description", "card-action"]) {
      expect(container.querySelector(`[data-slot="${slot}"]`)).toBeInTheDocument();
    }
    expect(screen.getByText("body")).toHaveAttribute("data-slot", "card-content");
    expect(screen.getByText("footer")).toHaveAttribute("data-slot", "card-footer");
    expect(screen.getByRole("button", { name: "copy" })).toBeInTheDocument();
  });

  it("records the compact size on the card", () => {
    const { container } = render(<Card size="sm">compact</Card>);

    expect(container.querySelector('[data-slot="card"]')).toHaveAttribute("data-size", "sm");
  });
});
