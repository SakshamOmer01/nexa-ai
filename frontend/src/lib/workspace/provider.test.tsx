import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceProvider, useWorkspace } from "@/lib/workspace/provider";
import { storageKey } from "@/lib/workspace/storage";
import type { MessageAttachment } from "@/lib/workspace/types";
import type { AuthUser } from "@/types/api";

const user: AuthUser = {
  id: "user-1",
  email: "ada@example.com",
  full_name: "Ada Lovelace",
  is_active: true,
  created_at: "2026-01-05T10:00:00Z",
};

type WorkspaceApi = ReturnType<typeof useWorkspace>;

let api: { current: WorkspaceApi };

async function mount() {
  const view = renderHook(() => useWorkspace(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <WorkspaceProvider user={user}>{children}</WorkspaceProvider>
    ),
  });
  api = view.result;
  await waitFor(() => expect(api.current.ready).toBe(true));
}

function conversationSeed() {
  return {
    id: "seed",
    title: "Seeded thread",
    createdAt: "2026-11-07T09:00:00Z",
    updatedAt: "2026-11-07T09:01:00Z",
    model: "gpt-4o-mini",
    mode: "chat",
    messages: [
      { id: "u1", role: "user", content: "What is a JWT?", createdAt: "2026-11-07T09:00:00Z" },
      {
        id: "a1",
        role: "assistant",
        content: "A signed token.",
        createdAt: "2026-11-07T09:01:00Z",
        model: "gpt-4o-mini",
      },
    ],
  };
}

const attachment: MessageAttachment = {
  id: "attachment-1",
  name: "notes.md",
  mimeType: "text/markdown",
  size: 9,
  content: "Some text",
  kind: "text",
};

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("WorkspaceProvider", () => {
  it("requires the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useWorkspace())).toThrow(
      "useWorkspace must be used inside <WorkspaceProvider>",
    );
    spy.mockRestore();
  });

  it("loads stored conversations, documents and settings", async () => {
    window.localStorage.setItem(storageKey(user.id, "conversations"), JSON.stringify([conversationSeed()]));
    window.localStorage.setItem(
      storageKey(user.id, "documents"),
      JSON.stringify([
        {
          id: "d1",
          name: "a.md",
          mimeType: "text/markdown",
          size: 1,
          content: "x",
          createdAt: "2026-11-07T09:00:00Z",
          origin: "upload",
        },
      ]),
    );
    window.localStorage.setItem(
      storageKey(user.id, "settings"),
      JSON.stringify({ defaultModel: "gpt-4o", responseStyle: "concise", sendOnEnter: false, showTimestamps: false }),
    );

    await mount();

    expect(api.current.conversations).toHaveLength(1);
    expect(api.current.documents).toHaveLength(1);
    expect(api.current.settings).toEqual({
      defaultModel: "gpt-4o",
      responseStyle: "concise",
      sendOnEnter: false,
      showTimestamps: false,
    });
    expect(api.current.activeConversation).toBeNull();

    act(() => api.current.selectConversation("seed"));
    expect(api.current.activeConversation?.title).toBe("Seeded thread");
    act(() => api.current.selectConversation(null));
    expect(api.current.activeConversation).toBeNull();
  });

  it("sends a message through the proxy and stores the real reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: "Real answer", model: "gpt-4o-mini" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await mount();

    let id: string | null = null;
    await act(async () => {
      id = await api.current.sendMessage({
        text: "Explain refresh tokens",
        attachments: [attachment],
        mode: "chat",
        model: "gpt-4o-mini",
      });
    });

    expect(id).toBeTruthy();
    const thread = api.current.conversations.find((item) => item.id === id);
    expect(thread?.title).toBe("Explain refresh tokens");
    expect(thread?.messages).toHaveLength(2);
    expect(thread?.messages[1]).toMatchObject({ role: "assistant", content: "Real answer" });
    expect(api.current.activeId).toBe(id);
    expect(api.current.pending).toBeNull();

    const request = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request[0]).toBe("/api/chat");
    const body = JSON.parse(String(request[1].body));
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.systemPrompt).toContain("Nexa AI");
    expect(body.messages[0].content).toContain("Attached file: notes.md");
    expect(window.localStorage.getItem(storageKey(user.id, "conversations"))).toContain("Real answer");
  });

  it("ignores empty sends and reuses an active thread of the same mode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ content: "One" }))),
      ),
    );
    await mount();

    let empty: string | null = "x";
    await act(async () => {
      empty = await api.current.sendMessage({ text: "   ", attachments: [], mode: "chat", model: "gpt-4o-mini" });
    });
    expect(empty).toBeNull();
    expect(api.current.conversations).toHaveLength(0);

    await act(async () => {
      await api.current.sendMessage({ text: "First", attachments: [], mode: "chat", model: "gpt-4o-mini" });
    });
    const firstId = api.current.activeId;
    await act(async () => {
      await api.current.sendMessage({ text: "Second", attachments: [], mode: "chat", model: "gpt-4o-mini" });
    });
    expect(api.current.activeId).toBe(firstId);
    expect(api.current.activeConversation?.messages).toHaveLength(4);

    await act(async () => {
      await api.current.sendMessage({ text: "Code ask", attachments: [], mode: "code", model: "gpt-4o-mini" });
    });
    expect(api.current.activeId).not.toBe(firstId);
    expect(api.current.activeConversation?.mode).toBe("code");
  });

  it("surfaces API, network and empty-response failures without inventing an answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { detail: "No AI provider is connected." } }), {
          status: 503,
        }),
      )
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: "   " })))
      .mockResolvedValueOnce(new Response("not json", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);
    await mount();

    for (const expected of [
      "No AI provider is connected.",
      "Could not reach the server.",
      "The assistant returned an empty response.",
      "The assistant could not answer (HTTP 502).",
    ]) {
      act(() => api.current.selectConversation(null));
      await act(async () => {
        await api.current.sendMessage({ text: "Question", attachments: [], mode: "chat", model: "gpt-4o-mini" });
      });
      const thread = api.current.activeConversation;
      expect(thread?.messages).toHaveLength(1);
      expect(api.current.errors[thread!.id]).toContain(expected);
    }
  });

  it("falls back safely for malformed error envelopes and keeps the requested model", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { detail: 42 } }), { status: 500 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(null), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify("oops"), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: "Reply" })));
    vi.stubGlobal("fetch", fetchMock);
    await mount();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      act(() => api.current.selectConversation(null));
      await act(async () => {
        await api.current.sendMessage({
          text: "Question",
          attachments: [],
          mode: "chat",
          model: "gpt-4o-mini",
        });
      });
      const thread = api.current.activeConversation!;
      expect(api.current.errors[thread.id]).toBe("The assistant could not answer (HTTP 500).");
    }

    act(() => api.current.selectConversation(null));
    await act(async () => {
      await api.current.sendMessage({
        text: "Question",
        attachments: [],
        mode: "chat",
        model: "gpt-4o-mini",
      });
    });
    const reply = api.current.activeConversation!.messages.at(-1);
    expect(reply?.content).toBe("Reply");
    expect(reply?.model).toBe("gpt-4o-mini");
  });

  it("regenerates by replacing the trailing answer", async () => {
    window.localStorage.setItem(storageKey(user.id, "conversations"), JSON.stringify([conversationSeed()]));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: "Fresh answer", model: "gpt-4o-mini" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await mount();

    await act(async () => {
      await api.current.regenerate("seed");
    });

    const thread = api.current.conversations[0];
    expect(thread.messages).toHaveLength(2);
    expect(thread.messages[1].content).toBe("Fresh answer");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores a regenerate request for an unknown thread", async () => {
    await mount();
    await act(async () => {
      await api.current.regenerate("missing");
    });
    expect(api.current.errors).toEqual({});
    expect(api.current.conversations).toEqual([]);
  });

  it("reports a conversation with no question to regenerate", async () => {
    window.localStorage.setItem(
      storageKey(user.id, "conversations"),
      JSON.stringify([
        {
          ...conversationSeed(),
          messages: [
            { id: "a1", role: "assistant", content: "Only an answer", createdAt: "2026-11-07T09:01:00Z" },
          ],
        },
      ]),
    );
    await mount();
    await act(async () => {
      await api.current.regenerate("seed");
    });
    expect(api.current.errors.seed).toContain("no question");
  });

  it("stops an in-flight generation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            });
          }),
      ),
    );
    await mount();

    let pendingSend: Promise<string | null> = Promise.resolve(null);
    act(() => {
      pendingSend = api.current.sendMessage({
        text: "Long question",
        attachments: [],
        mode: "chat",
        model: "gpt-4o-mini",
      });
    });

    await waitFor(() => expect(api.current.pending).not.toBeNull());
    act(() => api.current.stopGeneration());
    await act(async () => {
      await pendingSend;
    });

    const id = api.current.activeId!;
    expect(api.current.errors[id]).toBe("Generation stopped.");
    expect(api.current.pending).toBeNull();
  });

  it("renames, re-models, deletes and clears conversations", async () => {
    window.localStorage.setItem(storageKey(user.id, "conversations"), JSON.stringify([conversationSeed()]));
    await mount();

    act(() => api.current.renameConversation("seed", "  "));
    expect(api.current.conversations[0].title).toBe("Seeded thread");
    act(() => api.current.renameConversation("seed", "  Renamed thread  "));
    expect(api.current.conversations[0].title).toBe("Renamed thread");

    act(() => api.current.setConversationModel("seed", "gpt-4o"));
    expect(api.current.conversations[0].model).toBe("gpt-4o");
    act(() => api.current.setConversationModel("missing", "gpt-4o"));

    act(() => api.current.selectConversation("seed"));
    act(() => api.current.deleteConversation("seed"));
    expect(api.current.conversations).toEqual([]);
    expect(api.current.activeId).toBeNull();

    act(() =>
      api.current.updateSettings({ responseStyle: "detailed", sendOnEnter: false, defaultModel: "gpt-4o" }),
    );
    expect(api.current.settings).toMatchObject({
      responseStyle: "detailed",
      sendOnEnter: false,
      defaultModel: "gpt-4o",
    });
    expect(window.localStorage.getItem(storageKey(user.id, "settings"))).toContain("detailed");
  });

  it("adds, rejects and removes documents", async () => {
    await mount();

    const file = new File(["# Notes"], "notes.md", { type: "text/markdown" });
    let added: Awaited<ReturnType<WorkspaceApi["addDocument"]>> | undefined;
    await act(async () => {
      added = await api.current.addDocument(file);
    });
    expect(added?.ok).toBe(true);
    expect(api.current.documents).toHaveLength(1);
    expect(api.current.documents[0].content).toBe("# Notes");

    await act(async () => {
      const invalid = await api.current.addDocument(new File([], "empty.md", { type: "text/markdown" }));
      expect(invalid.ok).toBe(false);
    });

    await act(async () => {
      const whitespace = await api.current.addDocument(new File(["   "], "blank.md", { type: "text/markdown" }));
      expect(whitespace.error).toBe("That file contains no readable text.");
    });

    const unreadable = new File(["text"], "broken.md", { type: "text/markdown" });
    vi.spyOn(unreadable, "text").mockRejectedValue(new Error("read failed"));
    await act(async () => {
      const failed = await api.current.addDocument(unreadable);
      expect(failed.error).toContain("could not be read");
    });

    act(() => api.current.removeDocument(api.current.documents[0].id));
    expect(api.current.documents).toEqual([]);

    await act(async () => {
      await api.current.addDocument(file);
    });
    act(() => api.current.clearDocuments());
    expect(api.current.documents).toEqual([]);
  });

  it("queues a document for the chat composer", async () => {
    await mount();
    const file = new File(["text"], "notes.md", { type: "text/markdown" });
    await act(async () => {
      await api.current.addDocument(file);
    });

    act(() => api.current.queueAttachmentForChat(api.current.documents[0]));
    expect(api.current.queuedAttachment?.name).toBe("notes.md");
    act(() => api.current.clearQueuedAttachment());
    expect(api.current.queuedAttachment).toBeNull();
  });

  it("exports the workspace and clears conversation history", async () => {
    window.localStorage.setItem(storageKey(user.id, "conversations"), JSON.stringify([conversationSeed()]));
    await mount();
    const exported = JSON.parse(api.current.exportData());
    expect(exported.conversations).toHaveLength(1);
    expect(exported.settings).toBeTruthy();
    expect(exported.exportedAt).toBeTruthy();

    act(() => api.current.clearConversations());
    expect(api.current.conversations).toEqual([]);
  });

  it("reports a storage failure once and lets the notice be dismissed", async () => {
    await mount();
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    act(() => api.current.updateSettings({ responseStyle: "concise" }));
    await waitFor(() => expect(api.current.notice).toContain("storage is full"));
    act(() => api.current.dismissNotice());
    expect(api.current.notice).toBeNull();
  });
});
