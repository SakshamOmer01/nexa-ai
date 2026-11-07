export type ChatMode = "chat" | "code";
export type MessageRole = "user" | "assistant";
export type ResponseStyle = "balanced" | "concise" | "detailed";

export interface MessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** Extracted text, already clipped to the context budget when sent. */
  content: string;
  kind: "text";
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  model?: string;
  attachments?: MessageAttachment[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  mode: ChatMode;
  messages: ChatMessage[];
}

export interface ChatSettings {
  defaultModel: string;
  responseStyle: ResponseStyle;
  sendOnEnter: boolean;
  showTimestamps: boolean;
}

export interface StoredDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  content: string;
  createdAt: string;
  /** Where the document came from, so the library can explain itself honestly. */
  origin: "upload" | "chat";
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  defaultModel: "",
  responseStyle: "balanced",
  sendOnEnter: true,
  showTimestamps: true,
};
