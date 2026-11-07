import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Hero } from "@/components/sections/hero";
import { siteConfig } from "@/config/site";

describe("Hero", () => {
  it("leads with the product positioning and shared site description", () => {
    render(<Hero />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "everything you ask AI",
    );
    expect(screen.getByText(siteConfig.description)).toBeInTheDocument();
    expect(screen.getByText(/Documents, analytics and coding mode/)).toBeInTheDocument();
  });

  it("points the calls to action at signup, chat and the repository", () => {
    render(<Hero />);

    expect(screen.getByRole("link", { name: /Start for free/ })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "Open the assistant" })).toHaveAttribute(
      "href",
      "/chat",
    );

    const repo = screen.getByRole("link", { name: /View source/ });
    expect(repo).toHaveAttribute("href", siteConfig.githubUrl);
    expect(repo).toHaveAttribute("target", "_blank");
    expect(repo).toHaveAttribute("rel", "noreferrer");
  });

  it("shows the illustration and its honest caption", () => {
    render(<Hero />);

    expect(screen.getByText(/An illustration of the Nexa workspace/)).toBeInTheDocument();
    expect(screen.getByText("Local-first history")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Nexa AI" })).toBeInTheDocument();
  });
});
