import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/theme/theme-toggle";

afterEach(() => {
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
});

describe("ThemeToggle", () => {
  it("switches from light to dark and announces the action", async () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });

  it("renders the current mode with a label when asked", async () => {
    document.documentElement.classList.add("dark");
    render(<ThemeToggle withLabel />);

    expect(screen.getByRole("button", { name: "Switch to light mode" })).toHaveTextContent(
      "Switch to light mode",
    );
    await userEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
