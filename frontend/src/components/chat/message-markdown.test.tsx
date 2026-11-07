import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageMarkdown } from "@/components/chat/message-markdown";

describe("MessageMarkdown", () => {
  it("renders headings, lists, tables and highlighted code", () => {
    const { container } = render(
      <MessageMarkdown
        content={"# Title\n\n- one\n- two\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n```js\nconst x = 1;\n```"}
      />,
    );

    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(container.querySelector("pre code")?.textContent).toContain("const x = 1;");
  });

  it("opens links safely and renders images with alt text", () => {
    render(
      <MessageMarkdown content={"[Docs](https://example.com/docs)\n\n![diagram](https://example.com/a.png)"} />,
    );

    const link = screen.getByRole("link", { name: "Docs" });
    expect(link).toHaveAttribute("href", "https://example.com/docs");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");

    expect(screen.getByRole("img", { name: "diagram" })).toHaveAttribute(
      "src",
      "https://example.com/a.png",
    );
  });

  it("leaves raw HTML inert", () => {
    render(<MessageMarkdown content={"<script>alert('xss')</script>"} />);
    expect(document.querySelector("script")).toBeNull();
  });
});
