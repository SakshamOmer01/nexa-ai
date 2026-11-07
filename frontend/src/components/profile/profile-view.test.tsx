import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileView } from "@/components/profile/profile-view";
import type { useWorkspace } from "@/lib/workspace/provider";
import { DEFAULT_CHAT_SETTINGS, type Conversation } from "@/lib/workspace/types";
import type { AuthUser } from "@/types/api";

type WorkspaceApi = ReturnType<typeof useWorkspace>;

const mocks = vi.hoisted(() => ({
  workspace: null as unknown as WorkspaceApi,
  push: vi.fn(),
  downloadText: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/workspace/provider", () => ({ useWorkspace: () => mocks.workspace }));
vi.mock("@/lib/download", () => ({ downloadText: mocks.downloadText }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: mocks.refresh }),
}));

const user: AuthUser = {
  id: "8d3c1c1e-5d3f-4a1c-9a5e-6f0b1f2c3d4e",
  email: "ada@example.com",
  full_name: "Ada Lovelace",
  is_active: true,
  created_at: "2026-01-05T10:00:00Z",
};

const conversations: Conversation[] = [
  {
    id: "c1",
    title: "Refresh tokens",
    createdAt: "2026-11-07T09:00:00Z",
    updatedAt: "2026-11-07T09:01:00Z",
    model: "gpt-4o-mini",
    mode: "chat",
    messages: [
      { id: "m1", role: "user", content: "Hi", createdAt: "2026-11-07T09:00:00Z" },
      { id: "m2", role: "assistant", content: "Hello", createdAt: "2026-11-07T09:01:00Z" },
    ],
  },
  {
    id: "c2",
    title: "Fix a hook",
    createdAt: "2026-11-06T09:00:00Z",
    updatedAt: "2026-11-06T09:01:00Z",
    model: "gpt-4o",
    mode: "code",
    messages: [{ id: "m3", role: "user", content: "Code", createdAt: "2026-11-06T09:00:00Z" }],
  },
];

function workspace(overrides: Partial<WorkspaceApi> = {}): WorkspaceApi {
  return {
    user,
    conversations,
    documents: [],
    settings: DEFAULT_CHAT_SETTINGS,
    selectConversation: vi.fn(),
    exportData: vi.fn().mockReturnValue("{}"),
    ...overrides,
  } as WorkspaceApi;
}

beforeEach(() => {
  mocks.workspace = workspace();
  mocks.push.mockReset();
  mocks.downloadText.mockReset();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe("ProfileView", () => {
  it("shows the API account and real local workspace stats", () => {
    render(<ProfileView />);

    expect(screen.getByRole("heading", { level: 1, name: "Your profile" })).toBeInTheDocument();
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByText("Jan 5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("balanced")).toBeInTheDocument();
    expect(screen.getByText(/httpOnly, SameSite=Lax cookies/)).toBeInTheDocument();
    expect(screen.getAllByText("Refresh tokens").length).toBeGreaterThan(0);
  });

  it("copies the user id and confirms it", async () => {
    render(<ProfileView />);
    await userEvent.click(screen.getByRole("button", { name: "Copy user ID" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(user.id);
    expect(await screen.findByRole("button", { name: "Copy user ID" })).toBeInTheDocument();
  });

  it("survives a denied clipboard", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    render(<ProfileView />);
    await expect(
      userEvent.click(screen.getByRole("button", { name: "Copy user ID" })),
    ).resolves.not.toThrow();
  });

  it("exports the workspace from the profile", async () => {
    render(<ProfileView />);
    await userEvent.click(screen.getByRole("button", { name: "Export my data" }));
    expect(mocks.downloadText).toHaveBeenCalledWith(
      expect.stringMatching(/^nexa-profile-\d{4}-\d{2}-\d{2}\.json$/),
      "{}",
    );
  });

  it("opens recent conversations in the right surface", async () => {
    render(<ProfileView />);

    await userEvent.click(screen.getByRole("button", { name: /Fix a hook/ }));
    expect(mocks.workspace.selectConversation).toHaveBeenCalledWith("c2");
    expect(mocks.push).toHaveBeenCalledWith("/code");
  });

  it("handles an inactive account without a full name", () => {
    mocks.workspace = workspace({
      user: { ...user, full_name: null, is_active: false },
    });
    render(<ProfileView />);

    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ada").length).toBeGreaterThan(0);
  });

  it("shows an empty recent list and the settings shortcut", () => {
    mocks.workspace = workspace({ conversations: [] });
    render(<ProfileView />);

    expect(screen.getByText(/No conversations yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(screen.getByRole("link", { name: "Open chat" })).toHaveAttribute("href", "/chat");
  });
});
