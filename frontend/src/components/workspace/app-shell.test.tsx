import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MouseEventHandler, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/workspace/app-shell";
import type { useWorkspace } from "@/lib/workspace/provider";

type WorkspaceApi = ReturnType<typeof useWorkspace>;

const mocks = vi.hoisted(() => ({
  workspace: null as unknown as WorkspaceApi,
  pathname: "/chat",
}));

vi.mock("@/lib/workspace/provider", () => ({ useWorkspace: () => mocks.workspace }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    "aria-label": ariaLabel,
  }: {
    href: string;
    children: ReactNode;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
    "aria-label"?: string;
  }) => (
    <a href={href} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/workspace/sidebar", () => ({
  Sidebar: ({ onNavigate }: { onNavigate?: () => void }) => (
    <div data-testid="sidebar">
      <button type="button" onClick={onNavigate}>
        navigate
      </button>
    </div>
  ),
}));

beforeEach(() => {
  mocks.pathname = "/chat";
  mocks.workspace = {
    notice: null,
    dismissNotice: vi.fn(),
    selectConversation: vi.fn(),
  } as unknown as WorkspaceApi;
});

describe("AppShell", () => {
  it("renders the skip link, sidebar, page title and content", () => {
    render(
      <AppShell>
        <p>workspace content</p>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Skip to workspace content" })).toHaveAttribute(
      "href",
      "#workspace-main",
    );
    expect(screen.getByRole("complementary", { name: "Workspace sidebar" })).toBeInTheDocument();
    expect(screen.getAllByTestId("sidebar").length).toBeGreaterThan(0);
    expect(screen.getByText("AI Chat")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("workspace content");
  });

  it("opens and closes the mobile navigation drawer", async () => {
    render(<AppShell>content</AppShell>);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "navigate" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    await userEvent.click(await screen.findByRole("button", { name: "Close navigation" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts a new chat from the mobile header", async () => {
    render(<AppShell>content</AppShell>);
    await userEvent.click(screen.getByRole("link", { name: "Start a new chat" }));
    expect(mocks.workspace.selectConversation).toHaveBeenCalledWith(null);
  });

  it("surfaces and dismisses a storage notice", async () => {
    const dismissNotice = vi.fn();
    mocks.workspace = {
      notice: "Storage is full.",
      dismissNotice,
      selectConversation: vi.fn(),
    } as unknown as WorkspaceApi;
    render(<AppShell>content</AppShell>);

    expect(screen.getByRole("status")).toHaveTextContent("Storage is full.");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss storage notice" }));
    expect(dismissNotice).toHaveBeenCalledTimes(1);
  });

  it("falls back to the generic workspace title", () => {
    mocks.pathname = "/unknown";
    render(<AppShell>content</AppShell>);
    expect(screen.getByText("Workspace")).toBeInTheDocument();
  });
});
