import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessageItem } from "@/components/chat/message-item";
import type { ChatMessage } from "@/lib/workspace/types";

const message: ChatMessage = {
  id: "m1",
  role: "assistant",
  content: "## Answer\n\nUse `refresh tokens`.\n\n```ts\nconst ok = true;\n```",
  createdAt: "2026-11-07T09:05:00Z",
  model: "gpt-4o-mini",
};

const props = {
  userInitials: "AL",
  showTimestamp: true,
  canRegenerate: false,
  onRegenerate: vi.fn(),
  pending: false,
};

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
});

describe("MessageItem", () => {
  it("renders markdown, code and the model label", () => {
    const { container } = render(<MessageItem {...props} message={message} />);

    expect(screen.getByRole("heading", { name: "Answer" })).toBeInTheDocument();
    expect(screen.getByText("refresh tokens")).toBeInTheDocument();
    // Highlighting wraps tokens in spans, so assert on the code element's text content.
    expect(container.querySelector("pre code")?.textContent).toContain("const ok = true;");
    expect(screen.getByText("gpt-4o-mini")).toBeInTheDocument();
    expect(screen.getByText(/9:05/)).toBeInTheDocument();
  });

  it("copies the response and confirms it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<MessageItem {...props} message={message} />);

    await userEvent.click(screen.getByRole("button", { name: "Copy response" }));
    expect(writeText).toHaveBeenCalledWith(message.content);
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("reports a clipboard failure", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<MessageItem {...props} message={message} />);

    await userEvent.click(screen.getByRole("button", { name: "Copy response" }));
    expect(await screen.findByText("Copy failed")).toBeInTheDocument();
  });

  it("regenerates only when allowed", async () => {
    const onRegenerate = vi.fn();
    const { rerender } = render(<MessageItem {...props} message={message} />);
    expect(screen.queryByRole("button", { name: "Regenerate response" })).not.toBeInTheDocument();

    rerender(
      <MessageItem {...props} message={message} canRegenerate onRegenerate={onRegenerate} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Regenerate response" }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);

    rerender(<MessageItem {...props} message={message} canRegenerate pending />);
    expect(screen.getByRole("button", { name: "Regenerate response" })).toBeDisabled();
  });

  it("renders a user message with attachments and hides timestamps when configured", () => {
    render(
      <MessageItem
        {...props}
        showTimestamp={false}
        message={{
          id: "u1",
          role: "user",
          content: "",
          createdAt: "2026-11-07T09:05:00Z",
          attachments: [
            {
              id: "a1",
              name: "brief.md",
              mimeType: "text/markdown",
              size: 2_048,
              content: "hi",
              kind: "text",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("brief.md")).toBeInTheDocument();
    expect(screen.getByText("Attached a file.")).toBeInTheDocument();
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.queryByText(/9:05/)).not.toBeInTheDocument();
  });

  it("keeps copying available while a copy is in flight", async () => {
    let resolveCopy: () => void = () => {};
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCopy = resolve;
        }),
    );
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<MessageItem {...props} message={message} />);

    await userEvent.click(screen.getByRole("button", { name: "Copy response" }));
    expect(writeText).toHaveBeenCalled();
    resolveCopy();
    await waitFor(() => expect(screen.getByText("Copied")).toBeInTheDocument());
  });
});
