import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Composer } from "@/components/chat/composer";
import type { MessageAttachment, StoredDocument } from "@/lib/workspace/types";

const document: StoredDocument = {
  id: "d1",
  name: "notes.md",
  mimeType: "text/markdown",
  size: 12,
  content: "notes",
  createdAt: "2026-11-07T09:00:00Z",
  origin: "upload",
};

const attachment: MessageAttachment = {
  id: "a1",
  name: "brief.md",
  mimeType: "text/markdown",
  size: 2_048,
  content: "brief",
  kind: "text",
};

function Harness({
  onSubmit = vi.fn(),
  onStop = vi.fn(),
  onUploadFile = vi.fn().mockResolvedValue({ ok: true }),
  onAttachDocument = vi.fn(),
  onRemoveAttachment = vi.fn(),
  documents = [] as StoredDocument[],
  pending = false,
  sendOnEnter = true,
  initialAttachments = [] as MessageAttachment[],
  initialValue = "",
  disabled = false,
}: {
  onSubmit?: () => void;
  onStop?: () => void;
  onUploadFile?: (file: File) => Promise<{ ok: boolean; error?: string; attachment?: MessageAttachment }>;
  onAttachDocument?: (document: StoredDocument) => void;
  onRemoveAttachment?: (id: string) => void;
  documents?: StoredDocument[];
  pending?: boolean;
  sendOnEnter?: boolean;
  initialAttachments?: MessageAttachment[];
  initialValue?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <Composer
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      onStop={onStop}
      attachments={initialAttachments}
      onRemoveAttachment={onRemoveAttachment}
      onUploadFile={onUploadFile}
      onAttachDocument={onAttachDocument}
      documents={documents}
      pending={pending}
      sendOnEnter={sendOnEnter}
      placeholder="Ask Nexa anything…"
      disabled={disabled}
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
});

describe("Composer", () => {
  it("disables send for an empty message and sends on Enter", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<Harness onSubmit={onSubmit} />);

    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Message Nexa"), "Hello{enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll("textarea")).toHaveLength(1);
  });

  it("inserts a newline for Shift + Enter", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const textarea = screen.getByLabelText("Message Nexa");

    await userEvent.type(textarea, "Line one{Shift>}{Enter}{/Shift}Line two");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea).toHaveValue("Line one\nLine two");
  });

  it("uses the modifier shortcut when Enter-to-send is off", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} sendOnEnter={false} initialValue="Hello" />);

    expect(screen.getByText(/Ctrl \+ Enter to send/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Message Nexa"), "{enter}");
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Message Nexa"), "{Meta>}{Enter}{/Meta}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows a stop control while generating", async () => {
    const onStop = vi.fn();
    render(<Harness pending initialValue="Hello" onStop={onStop} />);

    expect(screen.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("renders and removes attachments", async () => {
    const onRemoveAttachment = vi.fn();
    render(
      <Harness initialAttachments={[attachment]} initialValue="Hello" onRemoveAttachment={onRemoveAttachment} />,
    );

    expect(screen.getByText("brief.md")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove brief.md" }));
    expect(onRemoveAttachment).toHaveBeenCalledWith("a1");
  });

  it("uploads a supported file and reports failures", async () => {
    const onUploadFile = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, attachment })
      .mockResolvedValueOnce({ ok: false, error: "Unsupported file type." });
    const { container } = render(<Harness onUploadFile={onUploadFile} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["text"], "notes.md", { type: "text/markdown" })] },
    });
    await waitFor(() => expect(onUploadFile).toHaveBeenCalledTimes(1));

    fireEvent.change(input, {
      target: { files: [new File(["image"], "photo.png", { type: "image/png" })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Unsupported file type.");
  });

  it("attaches a document from the library and handles an empty library", async () => {
    const onAttachDocument = vi.fn();
    const { rerender } = render(<Harness onAttachDocument={onAttachDocument} documents={[document]} />);

    await userEvent.click(screen.getByRole("button", { name: "Add attachment" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /From documents/ }));
    await userEvent.click(await screen.findByRole("button", { name: /notes\.md/ }));
    expect(onAttachDocument).toHaveBeenCalledWith(document);
    rerender(<Harness onAttachDocument={onAttachDocument} documents={[]} />);

    await userEvent.click(screen.getByRole("button", { name: "Add attachment" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /From documents/ }));
    expect(await screen.findByText("Your document library is empty.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a document" })).toHaveAttribute("href", "/documents");
  });

  it("explains that voice input is unsupported in this browser", async () => {
    render(<Harness initialValue="Hello" />);
    await userEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not supported in this browser");
  });

  it("toggles dictation and shows the listening state", async () => {
    class FakeRecognition {
      static instance: FakeRecognition | null = null;
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;

      constructor() {
        FakeRecognition.instance = this;
      }

      start() {}

      stop() {
        this.onend?.();
      }
    }
    (window as unknown as { SpeechRecognition: typeof FakeRecognition }).SpeechRecognition =
      FakeRecognition;
    render(<Harness initialValue="Hello" />);

    await userEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    expect(screen.getByRole("button", { name: "Stop voice input" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/Listening/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Stop voice input" }));
    expect(screen.getByRole("button", { name: "Start voice input" })).toBeInTheDocument();
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  });

  it("disables attachment controls at the limit and ignores empty file picks", async () => {
    const onUploadFile = vi.fn().mockResolvedValue({ ok: true });
    const four = Array.from({ length: 4 }, (_, index) => ({
      ...attachment,
      id: `a${index}`,
      name: `file-${index}.md`,
    }));
    const { container } = render(
      <Harness initialAttachments={four} onUploadFile={onUploadFile} />,
    );

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [] },
    });
    expect(onUploadFile).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Add attachment" }));
    expect(await screen.findByRole("menuitem", { name: /Upload a file/ })).toHaveAttribute(
      "data-disabled",
    );
    expect(screen.getByRole("menuitem", { name: /From documents/ })).toHaveAttribute(
      "data-disabled",
    );
  });

  it("disables controls when the composer is disabled", () => {
    render(<Harness disabled initialValue="Hello" />);
    expect(screen.getByLabelText("Message Nexa")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add attachment" })).toBeDisabled();
  });
});
