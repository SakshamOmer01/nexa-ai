import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatWorkspace } from "@/components/chat/chat-workspace";
import type { Composer } from "@/components/chat/composer";
import { DEFAULT_CHAT_SETTINGS, type ChatMessage, type Conversation, type StoredDocument } from "@/lib/workspace/types";
import type { useWorkspace } from "@/lib/workspace/provider";
import type { ModelsResponse } from "@/app/api/chat/models/route";
import type { AuthUser } from "@/types/api";

type WorkspaceApi = ReturnType<typeof useWorkspace>;
type ModelsHook = ReturnType<typeof import("@/lib/hooks/use-models").useModels>;

const state = vi.hoisted(() => ({
  workspace: null as unknown as WorkspaceApi,
  models: null as unknown as ModelsHook,
}));

vi.mock("@/lib/workspace/provider", () => ({
  useWorkspace: () => state.workspace,
}));

vi.mock("@/lib/hooks/use-models", () => ({
  useModels: () => state.models,
}));

const document: StoredDocument = {
  id: "d1",
  name: "brief.md",
  mimeType: "text/markdown",
  size: 5,
  content: "brief",
  createdAt: "2026-11-07T09:00:00Z",
  origin: "upload",
};

const queued = {
  id: "queued",
  name: "queued.md",
  mimeType: "text/markdown",
  size: 3,
  content: "q",
  kind: "text" as const,
};

const user: AuthUser = {
  id: "u1",
  email: "ada@example.com",
  full_name: "Ada Lovelace",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

const catalog: ModelsResponse = {
  configured: true,
  provider: "Example",
  defaultModel: "gpt-4o-mini",
  models: [
    { id: "gpt-4o-mini", name: "GPT-4o mini", description: "Fast" },
    { id: "gpt-4o", name: "GPT-4o", description: "Strong" },
  ],
};

const messages: ChatMessage[] = [
  { id: "m1", role: "user", content: "Question", createdAt: "2026-11-07T09:00:00Z" },
  {
    id: "m2",
    role: "assistant",
    content: "Answer",
    createdAt: "2026-11-07T09:01:00Z",
    model: "gpt-4o-mini",
  },
];

const conversation: Conversation = {
  id: "c1",
  title: "A thread",
  createdAt: "2026-11-07T09:00:00Z",
  updatedAt: "2026-11-07T09:01:00Z",
  model: "gpt-4o-mini",
  mode: "chat",
  messages,
};

function workspace(overrides: Partial<WorkspaceApi> = {}): WorkspaceApi {
  return {
    user,
    ready: true,
    activeConversation: null,
    settings: DEFAULT_CHAT_SETTINGS,
    documents: [document],
    pending: null,
    errors: {},
    selectConversation: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue("c1"),
    regenerate: vi.fn().mockResolvedValue(undefined),
    stopGeneration: vi.fn(),
    setConversationModel: vi.fn(),
    addDocument: vi.fn().mockResolvedValue({ ok: true, document }),
    queuedAttachment: null,
    clearQueuedAttachment: vi.fn(),
    ...overrides,
  } as WorkspaceApi;
}

function models(overrides: Partial<ModelsHook> = {}): ModelsHook {
  return {
    state: { phase: "ready", data: catalog },
    retry: vi.fn(),
    ...overrides,
  } as ModelsHook;
}

function MockComposer(props: ComponentProps<typeof Composer>) {
  return (
    <div
      data-testid="composer"
      data-disabled={String(props.disabled)}
      data-pending={String(props.pending)}
      data-send-on-enter={String(props.sendOnEnter)}
    >
      <span data-testid="composer-value">{props.value}</span>
      <span data-testid="composer-attachments">
        {props.attachments.map((attachment) => attachment.name).join("|")}
      </span>
      <button type="button" onClick={props.onSubmit}>
        send
      </button>
      <button type="button" onClick={props.onStop}>
        stop
      </button>
      <button type="button" onClick={() => props.onChange("typed prompt")}>
        type
      </button>
      <button
        type="button"
        onClick={() =>
          void props.onUploadFile(new File(["text"], "upload.md", { type: "text/markdown" }))
        }
      >
        upload
      </button>
      <button type="button" onClick={() => props.onAttachDocument(document)}>
        attach
      </button>
      <button
        type="button"
        onClick={() => props.onRemoveAttachment(props.attachments[0]?.id ?? "missing")}
      >
        remove
      </button>
    </div>
  );
}

vi.mock("@/components/chat/composer", () => ({ Composer: MockComposer }));
vi.mock("@/components/chat/model-select", () => ({
  ModelSelect: (props: { value: string; onChange: (model: string) => void }) => (
    <button type="button" onClick={() => props.onChange("gpt-4o")}>
      model:{props.value}
    </button>
  ),
}));

beforeEach(() => {
  state.workspace = workspace();
  state.models = models();
});

describe("ChatWorkspace", () => {
  it("shows a loading skeleton before local history resolves", () => {
    state.workspace = workspace({ ready: false });
    const { container } = render(<ChatWorkspace mode="chat" />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText("Loading conversation…")).toBeInTheDocument();
  });

  it("offers real starter prompts that fill the composer", async () => {
    render(<ChatWorkspace mode="chat" />);

    expect(screen.getByRole("heading", { name: "What should we work through?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Summarise a document" }));
    expect(screen.getByTestId("composer-value")).toHaveTextContent("Summarise the key points");
  });

  it("sends through the workspace with the resolved model and clears the draft", async () => {
    render(<ChatWorkspace mode="chat" />);

    await userEvent.click(screen.getByRole("button", { name: "type" }));
    await userEvent.click(screen.getByRole("button", { name: "send" }));

    expect(state.workspace.sendMessage).toHaveBeenCalledWith({
      text: "typed prompt",
      attachments: [],
      mode: "chat",
      model: "gpt-4o-mini",
    });
    await waitFor(() => expect(screen.getByTestId("composer-value")).toHaveTextContent(""));
  });

  it("starts a new chat and can change the draft model", async () => {
    render(<ChatWorkspace mode="chat" />);

    await userEvent.click(screen.getByRole("button", { name: "type" }));
    await userEvent.click(screen.getByRole("button", { name: "New" }));
    expect(state.workspace.selectConversation).toHaveBeenCalledWith(null);
    expect(screen.getByTestId("composer-value")).toHaveTextContent("");

    await userEvent.click(screen.getByRole("button", { name: "model:gpt-4o-mini" }));
    expect(screen.getByRole("button", { name: "model:gpt-4o" })).toBeInTheDocument();
  });

  it("renders a conversation, regenerates and retries a failed answer", async () => {
    state.workspace = workspace({
      activeConversation: conversation,
      errors: { c1: "Provider unavailable." },
    });
    render(<ChatWorkspace mode="chat" />);

    expect(screen.getByRole("heading", { name: "A thread" })).toBeInTheDocument();
    expect(screen.getByText("Answer")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Provider unavailable.");

    await userEvent.click(screen.getByRole("button", { name: "Regenerate response" }));
    expect(state.workspace.regenerate).toHaveBeenCalledWith("c1");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.workspace.regenerate).toHaveBeenCalledTimes(2);
  });

  it("locks the conversation to its own model", async () => {
    state.workspace = workspace({ activeConversation: conversation });
    render(<ChatWorkspace mode="chat" />);

    await userEvent.click(screen.getByRole("button", { name: "model:gpt-4o-mini" }));
    expect(state.workspace.setConversationModel).toHaveBeenCalledWith("c1", "gpt-4o");
  });

  it("shows generation progress and stops it", async () => {
    state.workspace = workspace({
      activeConversation: conversation,
      pending: { conversationId: "c1", phase: "sending" },
    });
    render(<ChatWorkspace mode="chat" />);

    expect(screen.getByLabelText("Nexa is thinking")).toBeInTheDocument();
    expect(screen.getByTestId("composer")).toHaveAttribute("data-pending", "true");
    await userEvent.click(screen.getByRole("button", { name: "stop" }));
    expect(state.workspace.stopGeneration).toHaveBeenCalledTimes(1);
  });

  it("does not show another conversation's pending state", () => {
    state.workspace = workspace({ pending: { conversationId: "other", phase: "sending" } });
    render(<ChatWorkspace mode="chat" />);
    expect(screen.queryByLabelText("Nexa is thinking")).not.toBeInTheDocument();
    expect(screen.getByTestId("composer")).toHaveAttribute("data-pending", "false");
  });

  it("warns when no provider or model catalog is available", async () => {
    state.models = models({
      state: { phase: "ready", data: { ...catalog, configured: false } },
    });
    const { rerender } = render(<ChatWorkspace mode="chat" />);
    expect(screen.getByText("No AI provider is connected.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Setup guide/ })).toHaveAttribute(
      "href",
      expect.stringContaining("README.md#ai-provider"),
    );

    const retry = vi.fn();
    state.models = models({ state: { phase: "error", message: "Catalog failed." }, retry });
    rerender(<ChatWorkspace mode="chat" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Catalog failed.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("disables the composer when no model can be resolved", () => {
    state.models = models({
      state: {
        phase: "ready",
        data: { ...catalog, defaultModel: "", models: [] },
      },
    });
    render(<ChatWorkspace mode="chat" />);
    expect(screen.getByTestId("composer")).toHaveAttribute("data-disabled", "true");
  });

  it("consumes a document queued from the library and can remove it", async () => {
    state.workspace = workspace({
      queuedAttachment: queued,
      sendMessage: vi.fn().mockResolvedValue("c1"),
    });
    render(<ChatWorkspace mode="chat" />);

    expect(screen.getByTestId("composer-attachments")).toHaveTextContent("queued.md");
    await userEvent.click(screen.getByRole("button", { name: "type" }));
    await userEvent.click(screen.getByRole("button", { name: "send" }));
    expect(state.workspace.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [queued],
      }),
    );
    expect(state.workspace.clearQueuedAttachment).toHaveBeenCalled();
  });

  it("removes a queued attachment without sending it", async () => {
    state.workspace = workspace({ queuedAttachment: queued });
    render(<ChatWorkspace mode="chat" />);
    await userEvent.click(screen.getByRole("button", { name: "remove" }));
    expect(state.workspace.clearQueuedAttachment).toHaveBeenCalled();
  });

  it("uploads files, attaches library documents and ignores duplicates", async () => {
    const addDocument = vi.fn().mockResolvedValue({ ok: true, document });
    state.workspace = workspace({ addDocument });
    render(<ChatWorkspace mode="chat" />);

    await userEvent.click(screen.getByRole("button", { name: "upload" }));
    await waitFor(() =>
      expect(screen.getByTestId("composer-attachments")).toHaveTextContent("brief.md"),
    );
    expect(addDocument).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "attach" }));
    await userEvent.click(screen.getByRole("button", { name: "attach" }));
    expect(screen.getByTestId("composer-attachments").textContent).toBe("brief.md");
  });

  it("stops adding attachments at the limit", async () => {
    state.workspace = workspace();
    render(<ChatWorkspace mode="chat" />);

    for (let index = 0; index < 5; index += 1) {
      await userEvent.click(screen.getByRole("button", { name: "upload" }));
      await waitFor(() =>
        expect(screen.getByTestId("composer-attachments").textContent).toBe(
          Array.from({ length: Math.min(index + 1, 4) }, () => "brief.md").join("|"),
        ),
      );
    }
    expect(state.workspace.addDocument).toHaveBeenCalledTimes(4);
  });

  it("does not send without a resolved model", async () => {
    state.models = models({
      state: { phase: "ready", data: { ...catalog, defaultModel: "", models: [] } },
    });
    render(<ChatWorkspace mode="chat" />);

    await userEvent.click(screen.getByRole("button", { name: "type" }));
    await userEvent.click(screen.getByRole("button", { name: "send" }));
    expect(state.workspace.sendMessage).not.toHaveBeenCalled();
  });

  it("reports an upload failure without adding an attachment", async () => {
    state.workspace = workspace({
      addDocument: vi.fn().mockResolvedValue({ ok: false, error: "Unsupported file." }),
    });
    render(<ChatWorkspace mode="chat" />);

    await userEvent.click(screen.getByRole("button", { name: "upload" }));
    await waitFor(() => expect(screen.getByTestId("composer-attachments")).toHaveTextContent(""));
  });

  it("removes a locally uploaded attachment", async () => {
    render(<ChatWorkspace mode="chat" />);
    await userEvent.click(screen.getByRole("button", { name: "upload" }));
    await waitFor(() =>
      expect(screen.getByTestId("composer-attachments")).toHaveTextContent("brief.md"),
    );

    await userEvent.click(screen.getByRole("button", { name: "remove" }));
    expect(screen.getByTestId("composer-attachments")).toHaveTextContent("");
  });

  it("ignores a queued library document in coding mode", () => {
    state.workspace = workspace({ queuedAttachment: queued });
    render(<ChatWorkspace mode="code" />);
    expect(screen.getByTestId("composer-attachments")).toHaveTextContent("");
  });

  it("offers retry but no regenerate for a failed question", () => {
    state.workspace = workspace({
      activeConversation: {
        ...conversation,
        messages: [messages[0]],
      },
      errors: { c1: "Failed." },
    });
    render(<ChatWorkspace mode="chat" />);

    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regenerate response" })).not.toBeInTheDocument();
  });

  it("uses coding-specific copy and keeps the coding mode on send", async () => {
    render(<ChatWorkspace mode="code" />);
    expect(screen.getByRole("heading", { name: "What are we building?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New coding session" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "type" }));
    await userEvent.click(screen.getByRole("button", { name: "send" }));
    expect(state.workspace.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "code" }),
    );
  });
});
