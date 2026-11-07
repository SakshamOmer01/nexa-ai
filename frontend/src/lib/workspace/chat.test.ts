import { describe, expect, it, vi } from "vitest";

import {
  appendMessage,
  attachmentContext,
  buildSystemPrompt,
  conversationTitle,
  createConversation,
  createMessage,
  lastUserMessage,
  MAX_CONTEXT_MESSAGES,
  messageText,
  newId,
  toWireMessages,
  withoutTrailingAssistant,
} from "@/lib/workspace/chat";
import { DEFAULT_CHAT_SETTINGS, type ChatMessage, type Conversation } from "@/lib/workspace/types";

const now = new Date("2026-11-07T12:00:00.000Z");

function conversation(messages: ChatMessage[] = []): Conversation {
  return {
    id: "conversation-1",
    title: "New conversation",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    model: "gpt-4o-mini",
    mode: "chat",
    messages,
  };
}

describe("newId", () => {
  it("uses crypto.randomUUID when available", () => {
    expect(newId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("falls back to a timestamp id when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {});
    expect(newId()).toMatch(/^id-/);
    vi.unstubAllGlobals();
  });
});

describe("conversationTitle", () => {
  it("compacts whitespace and truncates long asks", () => {
    expect(conversationTitle("  Hello\n\nworld ")).toBe("Hello world");
    const long = "a".repeat(70);
    expect(conversationTitle(long)).toBe(`${"a".repeat(61)}…`);
  });

  it("falls back for empty text", () => {
    expect(conversationTitle("   ")).toBe("New conversation");
  });
});

describe("createConversation / createMessage", () => {
  it("creates an empty conversation with a stable timestamp", () => {
    expect(createConversation("code", "gpt-4o", now)).toEqual({
      id: expect.any(String),
      title: "New conversation",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      model: "gpt-4o",
      mode: "code",
      messages: [],
    });
  });

  it("creates messages with optional model and attachments", () => {
    const message = createMessage("assistant", "Hello", { model: "gpt-4o" }, now);
    expect(message).toMatchObject({
      role: "assistant",
      content: "Hello",
      model: "gpt-4o",
      createdAt: now.toISOString(),
    });
    expect(message.attachments).toBeUndefined();
  });
});

describe("appendMessage", () => {
  it("names a fresh thread from the first user message", () => {
    const updated = appendMessage(conversation(), createMessage("user", "Explain JWT refresh", {}, now));
    expect(updated.title).toBe("Explain JWT refresh");
    expect(updated.messages).toHaveLength(1);
    expect(updated.updatedAt).toBe(now.toISOString());
  });

  it("uses the first attachment name when the message text is empty", () => {
    const updated = appendMessage(
      conversation(),
      createMessage(
        "user",
        "",
        {
          attachments: [
            { id: "a", name: "notes.md", mimeType: "text/markdown", size: 3, content: "abc", kind: "text" },
          ],
        },
        now,
      ),
    );
    expect(updated.title).toBe("notes.md");
  });

  it("keeps an existing title and does not rename on assistant messages", () => {
    const existing = { ...conversation(), title: "My thread" };
    const updated = appendMessage(existing, createMessage("assistant", "Hi", {}, now));
    expect(updated.title).toBe("My thread");
  });

  it("trims the oldest messages beyond the history cap", () => {
    const messages = Array.from({ length: 200 }, (_, index) =>
      createMessage(index % 2 === 0 ? "user" : "assistant", `message ${index}`, {}, now),
    );
    const updated = appendMessage(conversation(messages), createMessage("user", "latest", {}, now));
    expect(updated.messages).toHaveLength(200);
    expect(updated.messages.at(-1)?.content).toBe("latest");
    expect(updated.messages[0].content).toBe("message 1");
  });
});

describe("withoutTrailingAssistant / lastUserMessage", () => {
  it("removes every trailing assistant reply", () => {
    const source = conversation([
      createMessage("user", "q1", {}, now),
      createMessage("assistant", "a1", {}, now),
      createMessage("user", "q2", {}, now),
      createMessage("assistant", "a2", {}, now),
    ]);
    const trimmed = withoutTrailingAssistant(source);
    expect(trimmed.messages.map((message) => message.content)).toEqual(["q1", "a1", "q2"]);
    expect(lastUserMessage(trimmed)?.content).toBe("q2");
  });

  it("returns null when there is no user message", () => {
    expect(lastUserMessage(conversation())).toBeNull();
    expect(lastUserMessage(conversation([createMessage("assistant", "hello", {}, now)]))).toBeNull();
  });
});

describe("context building", () => {
  const attachment = {
    id: "a",
    name: "report.md",
    mimeType: "text/markdown",
    size: 30,
    content: "x".repeat(9_000),
    kind: "text" as const,
  };

  it("truncates long attachment text", () => {
    const context = attachmentContext(attachment);
    expect(context).toContain("Attached file: report.md");
    expect(context).toContain("…[truncated]");
    expect(context.length).toBeLessThan(9_100);
  });

  it("leaves short attachments intact", () => {
    expect(attachmentContext({ ...attachment, content: "short" })).toContain("<file>\nshort\n</file>");
  });

  it("appends attachment context to user messages only", () => {
    expect(messageText(createMessage("user", "see this", { attachments: [attachment] }, now))).toContain(
      "Attached file: report.md",
    );
    expect(
      messageText(createMessage("assistant", "see this", { attachments: [attachment] }, now)),
    ).toBe("see this");
  });

  it("drops empty messages, caps history length and trims each message", () => {
    const messages = Array.from({ length: 30 }, (_, index) =>
      createMessage("user", `msg ${index}`, {}, now),
    );
    messages.push(createMessage("assistant", "   ", {}, now));
    const wire = toWireMessages(conversation(messages));
    expect(wire).toHaveLength(MAX_CONTEXT_MESSAGES);
    expect(wire.at(-1)?.content).toBe("msg 29");

    const long = toWireMessages(conversation([createMessage("user", "y".repeat(13_000), {}, now)]));
    expect(long[0].content).toHaveLength(12_000);
  });

  it("composes mode and response-style instructions", () => {
    expect(buildSystemPrompt({ ...DEFAULT_CHAT_SETTINGS, responseStyle: "concise" }, "chat")).toContain(
      "fewest words",
    );
    expect(buildSystemPrompt({ ...DEFAULT_CHAT_SETTINGS, responseStyle: "detailed" }, "code")).toContain(
      "runnable code",
    );
    expect(buildSystemPrompt(DEFAULT_CHAT_SETTINGS, "chat")).toContain("clear and thorough");
  });
});
