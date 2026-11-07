import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentsView } from "@/components/documents/documents-view";
import type { useWorkspace } from "@/lib/workspace/provider";
import type { StoredDocument } from "@/lib/workspace/types";

type WorkspaceApi = ReturnType<typeof useWorkspace>;

const mocks = vi.hoisted(() => ({
  workspace: null as unknown as WorkspaceApi,
  push: vi.fn(),
}));

vi.mock("@/lib/workspace/provider", () => ({ useWorkspace: () => mocks.workspace }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

const upload: StoredDocument = {
  id: "d1",
  name: "brief.md",
  mimeType: "text/markdown",
  size: 2_048,
  content: "# Brief\nhello world",
  createdAt: "2026-11-07T09:00:00Z",
  origin: "upload",
};

const fromChat: StoredDocument = {
  id: "d2",
  name: "notes.txt",
  mimeType: "text/plain",
  size: 4,
  content: "notes from chat",
  createdAt: "2026-11-06T09:00:00Z",
  origin: "chat",
};

function workspace(overrides: Partial<WorkspaceApi> = {}): WorkspaceApi {
  return {
    documents: [upload, fromChat],
    ready: true,
    addDocument: vi.fn().mockResolvedValue({ ok: true, document: upload }),
    removeDocument: vi.fn(),
    queueAttachmentForChat: vi.fn(),
    ...overrides,
  } as WorkspaceApi;
}

beforeEach(() => {
  mocks.workspace = workspace();
  mocks.push.mockReset();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe("DocumentsView", () => {
  it("shows a skeleton until local documents resolve", () => {
    mocks.workspace = workspace({ ready: false });
    const { container } = render(<DocumentsView />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("shows an honest empty state with a working upload control", async () => {
    const addDocument = vi.fn();
    mocks.workspace = workspace({ documents: [], addDocument });
    render(<DocumentsView />);

    expect(screen.getByRole("heading", { name: "Your library is empty" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Choose a file" }));
    expect(addDocument).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Upload document" })).toBeInTheDocument();
  });

  it("lists documents with metadata and filters by origin and search", async () => {
    render(<DocumentsView />);

    expect(screen.getByText("brief.md")).toBeInTheDocument();
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "From chat" }));
    expect(screen.queryByText("brief.md")).not.toBeInTheDocument();
    expect(screen.getByText("notes.txt")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "All" }));
    await userEvent.type(screen.getByLabelText("Search documents"), "hello");
    expect(screen.getByText("brief.md")).toBeInTheDocument();
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Search documents"));
    await userEvent.type(screen.getByLabelText("Search documents"), "nothing");
    expect(screen.getByText("No matching documents")).toBeInTheDocument();
  });

  it("filters uploads and uses the singular document label", async () => {
    mocks.workspace = workspace({ documents: [upload] });
    render(<DocumentsView />);

    expect(screen.getByText("1 document")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Uploaded" }));
    expect(screen.getByText("brief.md")).toBeInTheDocument();
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
  });

  it("closes the preview dialog", async () => {
    render(<DocumentsView />);
    await userEvent.click(screen.getAllByRole("button", { name: "Preview" })[0]);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getAllByRole("button", { name: "Close" })[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a reading state while a file is being parsed", async () => {
    let finish: (result: { ok: boolean }) => void = () => {};
    const addDocument = vi.fn().mockReturnValue(
      new Promise<{ ok: boolean }>((resolve) => {
        finish = resolve;
      }),
    );
    mocks.workspace = workspace({ addDocument });
    const { container } = render(<DocumentsView />);

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["x"], "new.md", { type: "text/markdown" })] },
    });
    expect(screen.getByRole("button", { name: "Reading…" })).toBeDisabled();

    finish({ ok: false });
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be added");
    expect(screen.getByRole("button", { name: "Upload document" })).toBeEnabled();
  });

  it("uploads a file and reports validation failures", async () => {
    const addDocument = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, document: upload })
      .mockResolvedValueOnce({ ok: false, error: "Files must be 1 MB or smaller." });
    mocks.workspace = workspace({ addDocument });
    const { container } = render(<DocumentsView />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["x"], "new.md", { type: "text/markdown" })] },
    });
    await waitFor(() => expect(addDocument).toHaveBeenCalledTimes(1));

    fireEvent.change(input, {
      target: { files: [new File(["x"], "big.md", { type: "text/markdown" })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("1 MB or smaller");
  });

  it("previews a document, copies its text and sends it to chat", async () => {
    render(<DocumentsView />);

    await userEvent.click(screen.getAllByRole("button", { name: "Preview" })[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/# Brief/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Copy text" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(upload.content);
    expect(await within(dialog).findByText("Copied")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Use in chat" }));
    expect(mocks.workspace.queueAttachmentForChat).toHaveBeenCalledWith(upload);
    expect(mocks.push).toHaveBeenCalledWith("/chat");
  });

  it("reports a clipboard failure in the preview", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
      configurable: true,
    });
    render(<DocumentsView />);
    await userEvent.click(screen.getAllByRole("button", { name: "Preview" })[0]);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Copy text" }));
    expect(await within(dialog).findByText("Copy failed")).toBeInTheDocument();
  });

  it("queues a row for chat without opening the preview", async () => {
    render(<DocumentsView />);
    await userEvent.click(screen.getAllByRole("button", { name: "Use in chat" })[0]);
    expect(mocks.workspace.queueAttachmentForChat).toHaveBeenCalledWith(upload);
    expect(mocks.push).toHaveBeenCalledWith("/chat");
  });

  it("deletes a document after confirmation and can cancel", async () => {
    render(<DocumentsView />);

    await userEvent.click(screen.getByRole("button", { name: "Delete brief.md" }));
    const first = await screen.findByRole("dialog");
    await userEvent.click(within(first).getByRole("button", { name: "Cancel" }));
    expect(mocks.workspace.removeDocument).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Delete brief.md" }));
    const second = await screen.findByRole("dialog");
    await userEvent.click(within(second).getByRole("button", { name: "Delete document" }));
    expect(mocks.workspace.removeDocument).toHaveBeenCalledWith("d1");
  });

  it("deletes from the preview dialog", async () => {
    render(<DocumentsView />);
    await userEvent.click(screen.getAllByRole("button", { name: "Preview" })[1]);
    const preview = await screen.findByRole("dialog");
    await userEvent.click(within(preview).getAllByRole("button", { name: "Close" })[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete notes.txt" }));
    const confirm = await screen.findByRole("dialog");
    await userEvent.click(within(confirm).getByRole("button", { name: "Delete document" }));
    expect(mocks.workspace.removeDocument).toHaveBeenCalledWith("d2");
  });
});
