import type { Conversation, StoredDocument } from "@/lib/workspace/types";

export type AnalyticsRange = 7 | 30 | 0;

export interface DailyActivity {
  /** ISO date (UTC) used as the stable key. */
  date: string;
  label: string;
  messages: number;
}

export interface UsageSlice {
  label: string;
  value: number;
}

export interface AnalyticsSummary {
  conversations: number;
  messages: number;
  userMessages: number;
  assistantMessages: number;
  documents: number;
  attachments: number;
  words: number;
  averageMessages: number;
  longestConversation: { title: string; messages: number } | null;
  daily: DailyActivity[];
  modelUsage: UsageSlice[];
  modeUsage: UsageSlice[];
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayKey(date: Date): string {
  return startOfDay(date).toISOString().slice(0, 10);
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Build the trailing window, oldest first, including empty days so charts stay honest. */
export function dailyWindow(range: AnalyticsRange, now = new Date()): DailyActivity[] {
  const days = range === 0 ? 30 : range;
  const result: DailyActivity[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(startOfDay(now));
    date.setUTCDate(date.getUTCDate() - offset);
    result.push({
      date: date.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(date),
      messages: 0,
    });
  }
  return result;
}

export function summarizeWorkspace(
  conversations: Conversation[],
  documents: StoredDocument[],
  range: AnalyticsRange,
  now = new Date(),
): AnalyticsSummary {
  const window = dailyWindow(range, now);
  const byDay = new Map(window.map((day) => [day.date, day]));
  const cutoff = window[0]?.date ?? "0000-00-00";

  const modelCounts = new Map<string, number>();
  let messages = 0;
  let userMessages = 0;
  let assistantMessages = 0;
  let attachments = 0;
  let words = 0;
  let activeConversations = 0;
  let longest: AnalyticsSummary["longestConversation"] = null;
  const modeCounts = new Map<string, number>();

  for (const conversation of conversations) {
    let conversationMessages = 0;
    for (const message of conversation.messages) {
      const created = new Date(message.createdAt);
      if (Number.isNaN(created.getTime())) {
        continue;
      }
      const key = dayKey(created);
      if (range !== 0 && key < cutoff) {
        continue;
      }
      conversationMessages += 1;
      messages += 1;
      if (message.role === "user") {
        userMessages += 1;
      } else {
        assistantMessages += 1;
      }
      attachments += message.attachments?.length ?? 0;
      words += countWords(message.content);

      const day = byDay.get(key);
      if (day) {
        day.messages += 1;
      }
    }

    if (conversationMessages === 0) {
      continue;
    }
    activeConversations += 1;
    if (!longest || conversationMessages > longest.messages) {
      longest = { title: conversation.title, messages: conversationMessages };
    }
    const usedModel = conversation.model || "Unassigned";
    modelCounts.set(usedModel, (modelCounts.get(usedModel) ?? 0) + conversationMessages);
    const modeLabel = conversation.mode === "code" ? "Coding" : "Chat";
    modeCounts.set(modeLabel, (modeCounts.get(modeLabel) ?? 0) + 1);
  }

  return {
    conversations: activeConversations,
    messages,
    userMessages,
    assistantMessages,
    documents: documents.length,
    attachments,
    words,
    averageMessages: activeConversations === 0 ? 0 : Math.round(messages / activeConversations),
    longestConversation: longest,
    daily: window,
    modelUsage: [...modelCounts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    modeUsage: [...modeCounts.entries()].map(([label, value]) => ({ label, value })),
  };
}
