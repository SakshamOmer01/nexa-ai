import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "@/components/workspace/sidebar";
import type { useWorkspace } from "@/lib/workspace/provider";
import type { Conversation } from "@/lib/workspace/types";
import type { AuthUser } from "@/types/api";

type WorkspaceApi = ReturnType<typeof useWorkspace>;

const mocks = vi.hoisted(() => ({
  workspace: null as unknown as WorkspaceApi,
  push: vi.fn(),
  pathname: "/chat",
}));

vi.mock("@/lib/workspace/provider", () => ({ useWorkspace: () => mocks.workspace }));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push, replace: vi.fn(), refresh: vi.fn() }),
}));

const user: AuthUser = {
  id: "u1",
  email: "ada@example.com",
  full_name: "Ada Lovelace",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    title: "Refresh tokens",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    model: "gpt-4o-mini",
    mode: "chat",
    messages: [
      {
        id: "m1",
        role: "user",
        content: "Explain refresh token rotation",
        createdAt: new Date().toISOString(),
      },
    ],
    ...overrides,
  };
}

function workspace(overrides: Partial<WorkspaceApi> = {}): WorkspaceApi {
  return {
    user,
    conversations: [conversation()],
    activeId: null,
    ready: true,
    pending: null,
    selectConversation: vi.fn(),
    renameConversation: vi.fn(),
    deleteConversation: vi.fn(),
    ...overrides,
  } as WorkspaceApi;
}

beforeEach(() => {
  mocks.workspace = workspace();
  mocks.push.mockReset();
  mocks.pathname = "/chat";
});

describe("Sidebar", () => {
  it("shows a loading skeleton until history resolves", () => {
    mocks.workspace = workspace({ ready: false });
    const { container } = render(<Sidebar />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText("Refresh tokens")).not.toBeInTheDocument();
  });

  it("groups and opens conversations, routing by mode", async () => {
    const onNavigate = vi.fn();
    mocks.workspace = workspace({
      conversations: [
        conversation(),
        conversation({
          id: "c2",
          title: "Fix a hook",
          mode: "code",
          updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
        }),
      ],
    });
    render(<Sidebar onNavigate={onNavigate} />);

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Refresh tokens/ }));
    expect(mocks.workspace.selectConversation).toHaveBeenCalledWith("c1");
    expect(mocks.push).toHaveBeenCalledWith("/chat");

    await userEvent.click(screen.getByRole("button", { name: /^Fix a hook/ }));
    expect(mocks.push).toHaveBeenLastCalledWith("/code");
    expect(onNavigate).toHaveBeenCalled();
  });

  it("starts a new chat and closes the mobile drawer", async () => {
    const onNavigate = vi.fn();
    render(<Sidebar onNavigate={onNavigate} />);

    await userEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(mocks.workspace.selectConversation).toHaveBeenCalledWith(null);
    expect(mocks.push).toHaveBeenCalledWith("/chat");
    expect(onNavigate).toHaveBeenCalled();
  });

  it("searches titles and message contents", async () => {
    mocks.workspace = workspace({
      conversations: [
        conversation(),
        conversation({ id: "c2", title: "Budget plan", messages: [] }),
      ],
    });
    render(<Sidebar />);
    const search = screen.getByLabelText("Search conversations");

    await userEvent.type(search, "rotation");
    expect(screen.getByText("Refresh tokens")).toBeInTheDocument();
    expect(screen.queryByText("Budget plan")).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, "nothing-matches");
    expect(screen.getByText("No conversations match that search.")).toBeInTheDocument();
  });

  it("explains an empty history", () => {
    mocks.workspace = workspace({ conversations: [] });
    render(<Sidebar />);
    expect(
      screen.getByText("Your conversations will appear here after your first message."),
    ).toBeInTheDocument();
  });

  it("renames a conversation through the actions menu", async () => {
    render(<Sidebar />);

    await userEvent.click(screen.getByRole("button", { name: "Actions for Refresh tokens" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Rename/ }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Title");
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed thread");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save title" }));

    expect(mocks.workspace.renameConversation).toHaveBeenCalledWith("c1", "Renamed thread");
  });

  it("disables renaming to a blank title", async () => {
    render(<Sidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Actions for Refresh tokens" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Rename/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.clear(within(dialog).getByLabelText("Title"));
    expect(within(dialog).getByRole("button", { name: "Save title" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(mocks.workspace.renameConversation).not.toHaveBeenCalled();
  });

  it("deletes a conversation after confirmation", async () => {
    render(<Sidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Actions for Refresh tokens" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    const dialog = await screen.findByRole("dialog");

    await userEvent.click(within(dialog).getByRole("button", { name: "Delete conversation" }));
    expect(mocks.workspace.deleteConversation).toHaveBeenCalledWith("c1");

    await userEvent.click(screen.getByRole("button", { name: "Actions for Refresh tokens" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    const second = await screen.findByRole("dialog");
    await userEvent.click(within(second).getByRole("button", { name: "Keep it" }));
    expect(mocks.workspace.deleteConversation).toHaveBeenCalledTimes(1);
  });

  it("marks the active page and active conversation", () => {
    mocks.workspace = workspace({ activeId: "c1", pending: { conversationId: "c1", phase: "sending" } });
    render(<Sidebar />);

    const activeConversation = screen
      .getAllByRole("button", { name: /Refresh tokens/ })
      .find((button) => button.getAttribute("aria-current") === "page");
    expect(activeConversation).toBeDefined();
    expect(activeConversation).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Generating")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute("aria-current", "page");
  });

  it("links every workspace destination and signs out", () => {
    render(<Sidebar />);

    for (const [name, href] of [
      ["Chat", "/chat"],
      ["Coding Assistant", "/code"],
      ["Documents", "/documents"],
      ["Data Analytics", "/analytics"],
      ["Overview", "/dashboard"],
      ["Settings", "/settings"],
      ["Profile", "/profile"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/profile");
  });
});
