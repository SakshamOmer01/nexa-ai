import type {
  ChatMessage,
  ChatMode,
  ChatSettings,
  Conversation,
  MessageAttachment,
} from "@/lib/workspace/types";
import { MAX_MESSAGES_PER_CONVERSATION } from "@/lib/workspace/storage";

/** Characters of an attachment included in one request. */
export const ATTACHMENT_CONTEXT_CHARS = 8_000;
/** Characters of each message sent upstream; older turns are trimmed first. */
export const MESSAGE_CONTEXT_CHARS = 12_000;
/** Number of turns included in a request. */
export const MAX_CONTEXT_MESSAGES = 24;
export const MAX_ATTACHMENTS = 4;

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function conversationTitle(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "New conversation";
  }
  return compact.length > 64 ? `${compact.slice(0, 61).trimEnd()}…` : compact;
}

export function createConversation(
  mode: ChatMode,
  model: string,
  now = new Date(),
): Conversation {
  const timestamp = now.toISOString();
  return {
    id: newId(),
    title: "New conversation",
    createdAt: timestamp,
    updatedAt: timestamp,
    model,
    mode,
    messages: [],
  };
}

export function createMessage(
  role: ChatMessage["role"],
  content: string,
  extras: Partial<Pick<ChatMessage, "model" | "attachments">> = {},
  now = new Date(),
): ChatMessage {
  return {
    id: newId(),
    role,
    content,
    createdAt: now.toISOString(),
    ...extras,
  };
}

/** Append a message, trim the thread, keep ordering and rename a fresh thread from its first ask. */
export function appendMessage(conversation: Conversation, message: ChatMessage): Conversation {
  const messages = [...conversation.messages, message].slice(-MAX_MESSAGES_PER_CONVERSATION);
  // The first ask names the thread; later messages never rewrite the title.
  const isFirstUserMessage = !conversation.messages.some((item) => item.role === "user");
  return {
    ...conversation,
    title:
      isFirstUserMessage && message.role === "user"
        ? conversationTitle(message.content || message.attachments?.[0]?.name || "")
        : conversation.title,
    messages,
    updatedAt: message.createdAt,
  };
}

/** Drop assistant replies so regenerating replaces the answer instead of stacking a second one. */
export function withoutTrailingAssistant(conversation: Conversation): Conversation {
  const messages = [...conversation.messages];
  while (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
    messages.pop();
  }
  return { ...conversation, messages };
}

export function lastUserMessage(conversation: Conversation): ChatMessage | null {
  for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
    if (conversation.messages[index].role === "user") {
      return conversation.messages[index];
    }
  }
  return null;
}

export function attachmentContext(attachment: MessageAttachment): string {
  const content =
    attachment.content.length > ATTACHMENT_CONTEXT_CHARS
      ? `${attachment.content.slice(0, ATTACHMENT_CONTEXT_CHARS)}\n…[truncated]`
      : attachment.content;
  return `Attached file: ${attachment.name}\n<file>\n${content}\n</file>`;
}

export function messageText(message: ChatMessage): string {
  if (message.role === "user" && message.attachments?.length) {
    return [message.content, ...message.attachments.map(attachmentContext)]
      .filter(Boolean)
      .join("\n\n");
  }
  return message.content;
}

export interface WireMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function toWireMessages(conversation: Conversation): WireMessage[] {
  return conversation.messages
    .filter((message) => message.content.trim().length > 0 || message.attachments?.length)
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: messageText(message).slice(0, MESSAGE_CONTEXT_CHARS),
    }));
}

export function buildSystemPrompt(settings: ChatSettings, mode: ChatMode): string {
  const style = {
    concise: "Answer in the fewest words that fully resolve the request. Use short paragraphs.",
    balanced: "Be clear and thorough, but never pad. Prefer concrete examples and short lists.",
    detailed:
      "Explain your reasoning step by step, cover edge cases, and finish with a short summary.",
  }[settings.responseStyle];

  const modeLine =
    mode === "code"
      ? "You are in coding mode: produce runnable code, name the language on every fenced block, explain trade-offs, and call out tests the reader should run."
      : "You are a general assistant for research, writing, analysis and planning.";

  return [
    "You are Nexa AI, a precise, privacy-minded AI assistant.",
    modeLine,
    style,
    "Format answers in GitHub-flavoured Markdown. Never invent sources, files or command output. If you are unsure, say so and ask a clarifying question.",
  ].join(" ");
}
