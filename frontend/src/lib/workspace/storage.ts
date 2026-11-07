import {
  DEFAULT_CHAT_SETTINGS,
  type ChatMessage,
  type ChatSettings,
  type Conversation,
  type MessageAttachment,
  type StoredDocument,
} from "@/lib/workspace/types";

/** Conversations kept per account; older threads are dropped rather than growing without bound. */
export const MAX_CONVERSATIONS = 100;
export const MAX_MESSAGES_PER_CONVERSATION = 200;

export type StoreKind = "conversations" | "documents" | "settings";

export function storageKey(userId: string, kind: StoreKind): string {
  return `nexa:${userId}:${kind}`;
}

interface WriteResult {
  ok: boolean;
  error?: string;
}

export function readJson(key: string): unknown {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): WriteResult {
  if (typeof window === "undefined") {
    return { ok: false, error: "Storage is only available in the browser." };
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Your browser storage is full or unavailable. Recent changes were not saved.",
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAttachment(value: unknown): value is MessageAttachment {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.size === "number" &&
    typeof value.content === "string" &&
    value.kind === "text"
  );
}

function isMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string" &&
    typeof value.createdAt === "string" &&
    (value.model === undefined || typeof value.model === "string") &&
    (value.attachments === undefined ||
      (Array.isArray(value.attachments) && value.attachments.every(isAttachment)))
  );
}

function isConversation(value: unknown): value is Conversation {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.model === "string" &&
    (value.mode === "chat" || value.mode === "code") &&
    Array.isArray(value.messages) &&
    value.messages.every(isMessage)
  );
}

export function parseConversations(value: unknown): Conversation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isConversation)
    .slice(0, MAX_CONVERSATIONS)
    .map((conversation) => ({
      ...conversation,
      messages: conversation.messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
    }));
}

function isDocument(value: unknown): value is StoredDocument {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.size === "number" &&
    typeof value.content === "string" &&
    typeof value.createdAt === "string" &&
    (value.origin === "upload" || value.origin === "chat")
  );
}

export function parseDocuments(value: unknown): StoredDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isDocument);
}

export function parseSettings(value: unknown): ChatSettings {
  if (!isRecord(value)) {
    return DEFAULT_CHAT_SETTINGS;
  }
  return {
    defaultModel:
      typeof value.defaultModel === "string" ? value.defaultModel : DEFAULT_CHAT_SETTINGS.defaultModel,
    responseStyle:
      value.responseStyle === "concise" ||
      value.responseStyle === "detailed" ||
      value.responseStyle === "balanced"
        ? value.responseStyle
        : DEFAULT_CHAT_SETTINGS.responseStyle,
    sendOnEnter:
      typeof value.sendOnEnter === "boolean"
        ? value.sendOnEnter
        : DEFAULT_CHAT_SETTINGS.sendOnEnter,
    showTimestamps:
      typeof value.showTimestamps === "boolean"
        ? value.showTimestamps
        : DEFAULT_CHAT_SETTINGS.showTimestamps,
  };
}

export function loadWorkspace(userId: string): {
  conversations: Conversation[];
  documents: StoredDocument[];
  settings: ChatSettings;
} {
  return {
    conversations: parseConversations(readJson(storageKey(userId, "conversations"))),
    documents: parseDocuments(readJson(storageKey(userId, "documents"))),
    settings: parseSettings(readJson(storageKey(userId, "settings"))),
  };
}

export function saveConversations(userId: string, conversations: Conversation[]): WriteResult {
  return writeJson(storageKey(userId, "conversations"), conversations.slice(0, MAX_CONVERSATIONS));
}

export function saveDocuments(userId: string, documents: StoredDocument[]): WriteResult {
  return writeJson(storageKey(userId, "documents"), documents);
}

export function saveSettings(userId: string, settings: ChatSettings): WriteResult {
  return writeJson(storageKey(userId, "settings"), settings);
}

export function clearWorkspace(userId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  for (const kind of ["conversations", "documents", "settings"] as const) {
    try {
      window.localStorage.removeItem(storageKey(userId, kind));
    } catch {
      // Nothing useful to do if storage is unavailable.
    }
  }
}
