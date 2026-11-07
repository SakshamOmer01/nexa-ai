import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsView } from "@/components/analytics/analytics-view";
import type { useWorkspace } from "@/lib/workspace/provider";
import type { Conversation, StoredDocument } from "@/lib/workspace/types";

type WorkspaceApi = ReturnType<typeof useWorkspace>;

const mocks = vi.hoisted(() => ({
  workspace: null as unknown as WorkspaceApi,
  push: vi.fn(),
}));

vi.mock("@/lib/workspace/provider", () => ({ useWorkspace: () => mocks.workspace }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

const today = new Date().toISOString();
const yesterday = new Date(Date.now() - 86_400_000).toISOString();

const conversations: Conversation[] = [
  {
    id: "c1",
    title: "Refresh tokens",
    createdAt: today,
    updatedAt: today,
    model: "gpt-4o-mini",
    mode: "chat",
    messages: [
      { id: "m1", role: "user", content: "hello world", createdAt: today },
      { id: "m2", role: "assistant", content: "answer here", createdAt: today },
    ],
  },
  {
    id: "c2",
    title: "Fix the hook",
    createdAt: yesterday,
    updatedAt: yesterday,
    model: "gpt-4o",
    mode: "code",
    messages: [{ id: "m3", role: "user", content: "code please", createdAt: yesterday }],
  },
];

const document: StoredDocument = {
  id: "d1",
  name: "a.md",
  mimeType: "text/markdown",
  size: 1,
  content: "x",
  createdAt: today,
  origin: "upload",
};

function workspace(overrides: Partial<WorkspaceApi> = {}): WorkspaceApi {
  return {
    conversations,
    documents: [document],
    ready: true,
    selectConversation: vi.fn(),
    ...overrides,
  } as WorkspaceApi;
}

beforeEach(() => {
  mocks.workspace = workspace();
  mocks.push.mockReset();
});

describe("AnalyticsView", () => {
  it("shows a skeleton while the workspace loads", () => {
    mocks.workspace = workspace({ ready: false });
    const { container } = render(<AnalyticsView />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("shows a truthful empty state with next steps", () => {
    mocks.workspace = workspace({ conversations: [], documents: [] });
    render(<AnalyticsView />);

    expect(screen.getByRole("heading", { name: "No activity to measure yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start a chat/ })).toHaveAttribute("href", "/chat");
    expect(screen.getByRole("link", { name: /Add a document/ })).toHaveAttribute(
      "href",
      "/documents",
    );
  });

  it("summarises real conversations, models and documents", () => {
    render(<AnalyticsView />);

    expect(screen.getByText("Active conversations")).toBeInTheDocument();
    expect(screen.getAllByText("Messages").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Documents").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "Bar chart of messages per day" })).toBeInTheDocument();
    expect(screen.getByText("gpt-4o-mini")).toBeInTheDocument();
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Coding")).toBeInTheDocument();
    expect(screen.getByText("Refresh tokens")).toBeInTheDocument();
  });

  it("changes the measured window", async () => {
    render(<AnalyticsView />);
    const seven = screen.getByRole("button", { name: "7 days" });
    expect(seven).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "30 days" }));
    expect(screen.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText(/last 30 days/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "All time" }));
    expect(screen.getAllByText(/all time/).length).toBeGreaterThan(0);
  });

  it("opens a recent conversation in the right surface", async () => {
    render(<AnalyticsView />);
    const recent = screen.getByRole("button", { name: /Fix the hook/ });
    await userEvent.click(recent);

    expect(mocks.workspace.selectConversation).toHaveBeenCalledWith("c2");
    expect(mocks.push).toHaveBeenCalledWith("/code");
  });

  it("renders document-only workspaces without inventing conversations", () => {
    mocks.workspace = workspace({ conversations: [] });
    render(<AnalyticsView />);

    expect(screen.queryByRole("heading", { name: "No activity to measure yet" })).not.toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.queryByText("Recent activity")).not.toBeInTheDocument();
    expect(screen.getAllByText("No conversations yet.").length).toBeGreaterThan(0);
  });

  it("keeps the daily table available to assistive technology", () => {
    const { container } = render(<AnalyticsView />);
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(within(table as HTMLElement).getAllByRole("row").length).toBeGreaterThan(7);
  });
});
