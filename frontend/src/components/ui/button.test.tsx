import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its label as an enabled button with the default variant and size", () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("data-slot", "button");
    expect(button).toHaveAttribute("data-variant", "default");
    expect(button).toHaveAttribute("data-size", "default");
  });

  it("exposes the requested variant and size as data attributes", () => {
    render(
      <Button variant="destructive" size="sm">
        Delete
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveAttribute("data-variant", "destructive");
    expect(button).toHaveAttribute("data-size", "sm");
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Refresh</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick while disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Refresh
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders its child as the root element when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/docs">Docs</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Docs" });
    expect(link).toHaveAttribute("href", "/docs");
    expect(link).toHaveAttribute("data-slot", "button");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
