import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsView } from "@/components/settings/settings-view";
import type { ModelsResponse } from "@/app/api/chat/models/route";
import type { useWorkspace } from "@/lib/workspace/provider";
import { DEFAULT_CHAT_SETTINGS, type StoredDocument } from "@/lib/workspace/types";
import type { AuthUser } from "@/types/api";

type WorkspaceApi = ReturnType<typeof useWorkspace>;

const mocks = vi.hoisted(() => ({
  workspace: null as unknown as WorkspaceApi,
  models: null as unknown as ReturnType<typeof import("@/lib/hooks/use-models").useModels>,
  theme: { theme: "light", setTheme: vi.fn(), toggleTheme: vi.fn() },
  downloadText: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/lib/workspace/provider", () => ({ useWorkspace: () => mocks.workspace }));
vi.mock("@/lib/hooks/use-models", () => ({ useModels: () => mocks.models }));
vi.mock("@/lib/hooks/use-theme", () => ({ useTheme: () => mocks.theme }));
vi.mock("@/lib/download", () => ({ downloadText: mocks.downloadText }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, push: vi.fn() }),
}));

const user: AuthUser = {
  id: "u1",
  email: "ada@example.com",
  full_name: "Ada Lovelace",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

const document: StoredDocument = {
  id: "d1",
  name: "a.md",
  mimeType: "text/markdown",
  size: 1,
  content: "x",
  createdAt: "2026-11-07T09:00:00Z",
  origin: "upload",
};

const catalog: ModelsResponse = {
  configured: true,
  provider: "Example AI",
  defaultModel: "gpt-4o-mini",
  models: [
    { id: "gpt-4o-mini", name: "GPT-4o mini", description: "Fast" },
    { id: "gpt-4o", name: "GPT-4o", description: "Strong" },
  ],
};

function workspace(overrides: Partial<WorkspaceApi> = {}): WorkspaceApi {
  return {
    user,
    settings: DEFAULT_CHAT_SETTINGS,
    documents: [document],
    updateSettings: vi.fn(),
    exportData: vi.fn().mockReturnValue('{"ok":true}'),
    clearConversations: vi.fn(),
    clearDocuments: vi.fn(),
    ...overrides,
  } as WorkspaceApi;
}

function models(
  state: ReturnType<typeof import("@/lib/hooks/use-models").useModels>["state"] = {
    phase: "ready",
    data: catalog,
  },
): ReturnType<typeof import("@/lib/hooks/use-models").useModels> {
  return { state, retry: vi.fn() } as ReturnType<
    typeof import("@/lib/hooks/use-models").useModels
  >;
}

beforeEach(() => {
  mocks.workspace = workspace();
  mocks.models = models();
  mocks.theme = { theme: "light", setTheme: vi.fn(), toggleTheme: vi.fn() };
  mocks.downloadText.mockReset();
  mocks.replace.mockReset();
  mocks.refresh.mockReset();
});

describe("SettingsView", () => {
  it("renders every settings section for a configured provider", () => {
    render(<SettingsView />);

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Chat defaults")).toBeInTheDocument();
    expect(screen.getByText("AI provider")).toBeInTheDocument();
    expect(screen.getByText("Data & privacy")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText(/Example AI · 2 models available/)).toBeInTheDocument();
    expect(screen.getByText("gpt-4o-mini, gpt-4o")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/profile");
  });

  it("changes the theme", async () => {
    render(<SettingsView />);

    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(mocks.theme.setTheme).toHaveBeenCalledWith("dark");
    expect(screen.getByText("Follows your device until you choose.")).toBeInTheDocument();
  });

  it("updates response style, send shortcut, timestamps and default model", async () => {
    render(<SettingsView />);

    await userEvent.click(screen.getByRole("radio", { name: /Concise/ }));
    expect(mocks.workspace.updateSettings).toHaveBeenCalledWith({ responseStyle: "concise" });

    await userEvent.click(screen.getByRole("switch", { name: "Send with Enter" }));
    expect(mocks.workspace.updateSettings).toHaveBeenCalledWith({ sendOnEnter: false });

    await userEvent.click(screen.getByRole("switch", { name: "Show message timestamps" }));
    expect(mocks.workspace.updateSettings).toHaveBeenCalledWith({ showTimestamps: false });

    await userEvent.click(screen.getByRole("button", { name: "Model: GPT-4o mini" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /GPT-4o.*Strong/ }));
    expect(mocks.workspace.updateSettings).toHaveBeenCalledWith({ defaultModel: "gpt-4o" });
  });

  it("exports the workspace as JSON", async () => {
    render(<SettingsView />);
    await userEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    expect(mocks.downloadText).toHaveBeenCalledWith(
      expect.stringMatching(/^nexa-workspace-\d{4}-\d{2}-\d{2}\.json$/),
      '{"ok":true}',
    );
  });

  it("clears history and documents only after confirmation", async () => {
    render(<SettingsView />);

    await userEvent.click(screen.getByRole("button", { name: "Clear history" }));
    const historyDialog = await screen.findByRole("dialog");
    await userEvent.click(within(historyDialog).getByRole("button", { name: "Cancel" }));
    expect(mocks.workspace.clearConversations).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Clear history" }));
    const confirmHistory = await screen.findByRole("dialog");
    await userEvent.click(within(confirmHistory).getByRole("button", { name: "Clear history" }));
    expect(mocks.workspace.clearConversations).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Delete documents" }));
    const documentsDialog = await screen.findByRole("dialog");
    await userEvent.click(within(documentsDialog).getByRole("button", { name: "Delete documents" }));
    expect(mocks.workspace.clearDocuments).toHaveBeenCalledTimes(1);
  });

  it("disables document deletion when the library is empty", () => {
    mocks.workspace = workspace({ documents: [] });
    render(<SettingsView />);
    expect(screen.getByRole("button", { name: "Delete documents" })).toBeDisabled();
    expect(screen.getByText(/0 documents in your library/)).toBeInTheDocument();
  });

  it("explains an unconfigured provider", () => {
    mocks.models = models({
      phase: "ready",
      data: { ...catalog, configured: false, defaultModel: "", models: [] },
    });
    render(<SettingsView />);

    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getByText(/Set AI_API_KEY on the server/)).toBeInTheDocument();
    expect(screen.getByText("AI_API_KEY")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("shows loading and error states for the catalog", async () => {
    mocks.models = models({ phase: "loading" });
    const { rerender } = render(<SettingsView />);
    expect(screen.getByText("Checking the model catalog…")).toBeInTheDocument();

    const retry = vi.fn();
    mocks.models = { state: { phase: "error", message: "Cannot load models." }, retry } as ReturnType<
      typeof import("@/lib/hooks/use-models").useModels
    >;
    rerender(<SettingsView />);
    expect(screen.getByRole("alert")).toHaveTextContent("Cannot load models.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
