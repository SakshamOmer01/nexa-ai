import { describe, expect, it } from "vitest";

import { dailyWindow, summarizeWorkspace } from "@/lib/workspace/analytics";
import type { Conversation, StoredDocument } from "@/lib/workspace/types";

const now = new Date("2026-11-07T12:00:00Z");

function message(role: "user" | "assistant", createdAt: string, content = "one two three") {
  return { id: `${role}-${createdAt}`, role, content, createdAt };
}

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    title: "Thread",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    model: "gpt-4o-mini",
    mode: "chat",
    messages: [],
    ...overrides,
  };
}

const document: StoredDocument = {
  id: "d1",
  name: "a.md",
  mimeType: "text/markdown",
  size: 1,
  content: "x",
  createdAt: now.toISOString(),
  origin: "upload",
};

describe("dailyWindow", () => {
  it("builds an inclusive trailing window, oldest first", () => {
    const days = dailyWindow(7, now);
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe("2026-11-01");
    expect(days[6].date).toBe("2026-11-07");
    expect(days[6].label).toContain("7");
  });

  it("uses 30 buckets for the all-time chart", () => {
    expect(dailyWindow(0, now)).toHaveLength(30);
  });
});

describe("summarizeWorkspace", () => {
  it("returns a truthful empty summary", () => {
    const summary = summarizeWorkspace([], [], 7, now);
    expect(summary).toMatchObject({
      conversations: 0,
      messages: 0,
      documents: 0,
      words: 0,
      averageMessages: 0,
      longestConversation: null,
      modelUsage: [],
      modeUsage: [],
    });
    expect(summary.daily).toHaveLength(7);
  });

  it("counts messages, words, attachments and model usage inside the window", () => {
    const summary = summarizeWorkspace(
      [
        conversation({
          messages: [
            message("user", "2026-11-07T10:00:00Z", "hello there world"),
            {
              ...message("assistant", "2026-11-07T10:01:00Z", "hi"),
              attachments: [
                { id: "a", name: "a.txt", mimeType: "text/plain", size: 1, content: "x", kind: "text" },
              ],
            },
            message("user", "2026-10-01T10:00:00Z"),
          ],
        }),
        conversation({
          id: "c2",
          title: "Code",
          mode: "code",
          model: "gpt-4o",
          messages: [
            message("user", "2026-11-06T10:00:00Z"),
            message("assistant", "2026-11-06T10:01:00Z"),
          ],
        }),
        conversation({ id: "c3", messages: [message("user", "not-a-date")] }),
      ],
      [document],
      7,
      now,
    );

    expect(summary.conversations).toBe(2);
    expect(summary.messages).toBe(4);
    expect(summary.userMessages).toBe(2);
    expect(summary.assistantMessages).toBe(2);
    expect(summary.attachments).toBe(1);
    expect(summary.words).toBe(3 + 1 + 6);
    expect(summary.documents).toBe(1);
    expect(summary.averageMessages).toBe(2);
    expect(summary.longestConversation).toEqual({ title: "Thread", messages: 2 });
    expect(summary.modelUsage).toEqual([
      { label: "gpt-4o-mini", value: 2 },
      { label: "gpt-4o", value: 2 },
    ]);
    expect(summary.modeUsage).toEqual([
      { label: "Chat", value: 1 },
      { label: "Coding", value: 1 },
    ]);
    expect(summary.daily.at(-1)?.messages).toBe(2);
    expect(summary.daily.at(-2)?.messages).toBe(2);
  });

  it("includes older messages in the all-time summary and falls back for an unassigned model", () => {
    const summary = summarizeWorkspace(
      [
        conversation({
          model: "",
          messages: [message("user", "2025-01-01T10:00:00Z", "a")],
        }),
      ],
      [],
      0,
      now,
    );
    expect(summary.messages).toBe(1);
    expect(summary.modelUsage).toEqual([{ label: "Unassigned", value: 1 }]);
    expect(summary.daily).toHaveLength(30);
  });

  it("tracks the longest conversation across several threads", () => {
    const summary = summarizeWorkspace(
      [
        conversation({
          title: "Short",
          messages: [message("user", "2026-11-07T10:00:00Z")],
        }),
        conversation({
          id: "c2",
          title: "Long",
          messages: [
            message("user", "2026-11-07T10:00:00Z"),
            message("assistant", "2026-11-07T10:01:00Z"),
          ],
        }),
      ],
      [],
      7,
      now,
    );
    expect(summary.longestConversation).toEqual({ title: "Long", messages: 2 });
  });
});
