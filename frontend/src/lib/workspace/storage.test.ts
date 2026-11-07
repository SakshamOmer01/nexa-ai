import { describe, expect, it, vi } from "vitest";

import {
  clearWorkspace,
  loadWorkspace,
  MAX_CONVERSATIONS,
  parseConversations,
  parseDocuments,
  parseSettings,
  readJson,
  saveConversations,
  saveDocuments,
  saveSettings,
  storageKey,
  writeJson,
} from "@/lib/workspace/storage";
import { DEFAULT_CHAT_SETTINGS, type Conversation, type StoredDocument } from "@/lib/workspace/types";

const conversation: Conversation = {
  id: "c1",
  title: "Thread",
  createdAt: "2026-11-07T10:00:00Z",
  updatedAt: "2026-11-07T10:00:00Z",
  model: "gpt-4o-mini",
  mode: "chat",
  messages: [
    { id: "m1", role: "user", content: "hi", createdAt: "2026-11-07T10:00:00Z" },
  ],
};

const document: StoredDocument = {
  id: "d1",
  name: "notes.md",
  mimeType: "text/markdown",
  size: 12,
  content: "hello",
  createdAt: "2026-11-07T10:00:00Z",
  origin: "upload",
};

describe("storage helpers", () => {
  it("namespaces every key by account and kind", () => {
    expect(storageKey("user-1", "conversations")).toBe("nexa:user-1:conversations");
    expect(storageKey("user-1", "settings")).toBe("nexa:user-1:settings");
  });

  it("returns null for missing, corrupt and server-side reads", () => {
    expect(readJson("missing")).toBeNull();
    window.localStorage.setItem("broken", "{not json");
    expect(readJson("broken")).toBeNull();

    vi.stubGlobal("window", undefined);
    expect(readJson("anything")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("writes JSON and reports quota failures instead of throwing", () => {
    expect(writeJson("key", { a: 1 })).toEqual({ ok: true });
    expect(readJson("key")).toEqual({ a: 1 });

    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const result = writeJson("key", { a: 2 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("storage is full");
    vi.restoreAllMocks();

    vi.stubGlobal("window", undefined);
    expect(writeJson("key", {})).toEqual({
      ok: false,
      error: "Storage is only available in the browser.",
    });
    vi.unstubAllGlobals();
  });

  it("drops malformed conversations and caps history", () => {
    const parsed = parseConversations([
      conversation,
      { ...conversation, id: 2 } as unknown,
      { ...conversation, mode: "invalid" } as unknown,
      {
        ...conversation,
        id: "c2",
        messages: [
          ...conversation.messages,
          { id: "bad", role: "system", content: "", createdAt: "" } as unknown,
        ],
      },
    ]);
    // A conversation with even one malformed message is dropped whole.
    expect(parsed).toEqual([conversation]);

    expect(parseConversations("nope")).toEqual([]);
    const many = Array.from({ length: MAX_CONVERSATIONS + 5 }, (_, index) => ({
      ...conversation,
      id: `c-${index}`,
    }));
    expect(parseConversations(many)).toHaveLength(MAX_CONVERSATIONS);
  });

  it("keeps message attachments when they are well formed", () => {
    const withAttachment: Conversation = {
      ...conversation,
      messages: [
        {
          ...conversation.messages[0],
          attachments: [
            { id: "a", name: "a.txt", mimeType: "text/plain", size: 1, content: "x", kind: "text" },
          ],
        },
      ],
    };
    expect(parseConversations([withAttachment])).toEqual([withAttachment]);
    expect(
      parseConversations([
        {
          ...withAttachment,
          messages: [{ ...withAttachment.messages[0], attachments: [{ id: "a" }] }],
        } as unknown,
      ]),
    ).toEqual([]);
  });

  it("validates documents and settings", () => {
    expect(parseDocuments([document, { id: "bad" }])).toEqual([document]);
    expect(parseDocuments(null)).toEqual([]);
    expect(parseSettings(null)).toEqual(DEFAULT_CHAT_SETTINGS);
    expect(
      parseSettings({
        defaultModel: "gpt-4o",
        responseStyle: "detailed",
        sendOnEnter: false,
        showTimestamps: false,
      }),
    ).toEqual({
      defaultModel: "gpt-4o",
      responseStyle: "detailed",
      sendOnEnter: false,
      showTimestamps: false,
    });
    expect(
      parseSettings({ responseStyle: "verbose", sendOnEnter: "yes" } as unknown),
    ).toEqual(DEFAULT_CHAT_SETTINGS);
  });

  it("loads and saves the whole workspace, trimming conversations", () => {
    window.localStorage.setItem(storageKey("u", "conversations"), JSON.stringify([conversation]));
    window.localStorage.setItem(storageKey("u", "documents"), JSON.stringify([document]));
    window.localStorage.setItem(
      storageKey("u", "settings"),
      JSON.stringify({ ...DEFAULT_CHAT_SETTINGS, defaultModel: "gpt-4o" }),
    );

    expect(loadWorkspace("u")).toEqual({
      conversations: [conversation],
      documents: [document],
      settings: { ...DEFAULT_CHAT_SETTINGS, defaultModel: "gpt-4o" },
    });

    const many = Array.from({ length: MAX_CONVERSATIONS + 2 }, (_, index) => ({
      ...conversation,
      id: `c-${index}`,
    }));
    expect(saveConversations("u", many).ok).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(storageKey("u", "conversations")) ?? "[]")).toHaveLength(
      MAX_CONVERSATIONS,
    );
    expect(saveDocuments("u", [document]).ok).toBe(true);
    expect(saveSettings("u", DEFAULT_CHAT_SETTINGS).ok).toBe(true);
  });

  it("clears every workspace key and tolerates unavailable storage", () => {
    window.localStorage.setItem(storageKey("u", "conversations"), "[]");
    window.localStorage.setItem(storageKey("u", "documents"), "[]");
    clearWorkspace("u");
    expect(window.localStorage.getItem(storageKey("u", "conversations"))).toBeNull();
    expect(window.localStorage.getItem(storageKey("u", "documents"))).toBeNull();

    vi.spyOn(window.localStorage, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => clearWorkspace("u")).not.toThrow();
    vi.restoreAllMocks();

    vi.stubGlobal("window", undefined);
    expect(() => clearWorkspace("u")).not.toThrow();
    vi.unstubAllGlobals();
  });
});
