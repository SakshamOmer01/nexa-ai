"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { DEFAULT_CHAT_SETTINGS, type Conversation, type StoredDocument } from "@/lib/workspace/types";
import {
  appendMessage,
  buildSystemPrompt,
  createConversation,
  createMessage,
  lastUserMessage,
  toWireMessages,
  withoutTrailingAssistant,
} from "@/lib/workspace/chat";
import {
  readFileText,
  toAttachment,
  toDocument,
  fileValidationMessage,
} from "@/lib/workspace/documents";
import {
  loadWorkspace,
  saveConversations,
  saveDocuments,
  saveSettings,
} from "@/lib/workspace/storage";
import type {
  ChatMode,
  ChatSettings,
  MessageAttachment,
} from "@/lib/workspace/types";
import type { AuthUser } from "@/types/api";

interface SendInput {
  text: string;
  attachments: MessageAttachment[];
  mode: ChatMode;
  model: string;
}

interface WorkspaceContextValue {
  user: AuthUser;
  conversations: Conversation[];
  documents: StoredDocument[];
  settings: ChatSettings;
  activeId: string | null;
  ready: boolean;
  pending: { conversationId: string; phase: "sending" | "regenerating" } | null;
  errors: Record<string, string>;
  notice: string | null;
  activeConversation: Conversation | null;
  /** A document handed to the chat composer from the library. */
  queuedAttachment: MessageAttachment | null;
  queueAttachmentForChat: (document: StoredDocument) => void;
  clearQueuedAttachment: () => void;
  selectConversation: (id: string | null) => void;
  sendMessage: (input: SendInput) => Promise<string | null>;
  regenerate: (conversationId: string) => Promise<void>;
  stopGeneration: () => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setConversationModel: (id: string, model: string) => void;
  updateSettings: (patch: Partial<ChatSettings>) => void;
  addDocument: (file: File) => Promise<{ ok: boolean; error?: string; document?: StoredDocument }>;
  removeDocument: (id: string) => void;
  clearDocuments: () => void;
  clearConversations: () => void;
  exportData: () => string;
  dismissNotice: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function errorDetail(body: unknown, fallback: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: { detail?: unknown } }).error?.detail === "string"
  ) {
    return (body as { error: { detail: string } }).error.detail;
  }
  return fallback;
}

export function WorkspaceProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_CHAT_SETTINGS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<WorkspaceContextValue["pending"]>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [queuedAttachment, setQueuedAttachment] = useState<MessageAttachment | null>(null);

  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const stored = loadWorkspace(user.id);
    setConversations(stored.conversations);
    setDocuments(stored.documents);
    setSettings(stored.settings);
    setReady(true);
    return () => {
      abortRef.current?.abort();
    };
  }, [user.id]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const result = saveConversations(user.id, conversations);
    if (!result.ok && result.error) {
      setNotice(result.error);
    }
  }, [conversations, ready, user.id]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const result = saveDocuments(user.id, documents);
    if (!result.ok && result.error) {
      setNotice(result.error);
    }
  }, [documents, ready, user.id]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const result = saveSettings(user.id, settings);
    if (!result.ok && result.error) {
      setNotice(result.error);
    }
  }, [settings, ready, user.id]);

  const selectConversation = useCallback((id: string | null) => {
    setActiveId(id);
  }, []);

  const runCompletion = useCallback(
    async (conversation: Conversation, phase: "sending" | "regenerating", model: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setPending({ conversationId: conversation.id, phase });
      setErrors((current) => {
        const next = { ...current };
        delete next[conversation.id];
        return next;
      });

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            systemPrompt: buildSystemPrompt(settings, conversation.mode),
            messages: toWireMessages(conversation),
          }),
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            errorDetail(body, `The assistant could not answer (HTTP ${response.status}).`),
          );
        }

        const body = (await response.json()) as { content?: unknown; model?: unknown };
        if (typeof body.content !== "string" || body.content.trim() === "") {
          throw new Error("The assistant returned an empty response. Try regenerating.");
        }

        const reply = createMessage("assistant", body.content, {
          model: typeof body.model === "string" ? body.model : model,
        });
        setConversations((current) =>
          current.map((item) =>
            item.id === conversation.id ? appendMessage(item, reply) : item,
          ),
        );
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        setErrors((current) => ({
          ...current,
          [conversation.id]: aborted
            ? "Generation stopped."
            : error instanceof TypeError
              ? "Could not reach the server. Check your connection and try again."
              : error instanceof Error
                ? error.message
                : "The assistant could not answer.",
        }));
      } finally {
        abortRef.current = null;
        setPending(null);
      }
    },
    [settings],
  );

  const sendMessage = useCallback(
    async ({ text, attachments, mode, model }: SendInput): Promise<string | null> => {
      const trimmed = text.trim();
      if (!trimmed && attachments.length === 0) {
        return null;
      }

      const existing = conversationsRef.current.find((item) => item.id === activeId);
      const base =
        existing && existing.mode === mode ? existing : createConversation(mode, model);
      const userMessage = createMessage("user", trimmed, {
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      const updated = appendMessage(base, userMessage);

      setConversations((current) => {
        const withoutBase = current.filter((item) => item.id !== updated.id);
        return [updated, ...withoutBase];
      });
      setActiveId(updated.id);

      await runCompletion(updated, "sending", model);
      return updated.id;
    },
    [activeId, runCompletion],
  );

  const regenerate = useCallback(
    async (conversationId: string) => {
      const conversation = conversationsRef.current.find((item) => item.id === conversationId);
      if (!conversation) {
        return;
      }
      const trimmed = withoutTrailingAssistant(conversation);
      if (!lastUserMessage(trimmed)) {
        setErrors((current) => ({
          ...current,
          [conversationId]: "There is no question to regenerate an answer for.",
        }));
        return;
      }
      setConversations((current) =>
        current.map((item) => (item.id === conversationId ? trimmed : item)),
      );
      await runCompletion(trimmed, "regenerating", conversation.model);
    },
    [runCompletion],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      if (pending?.conversationId === id) {
        abortRef.current?.abort();
      }
      setConversations((current) => current.filter((item) => item.id !== id));
      setActiveId((current) => (current === id ? null : current));
      setErrors((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    },
    [pending],
  );

  const renameConversation = useCallback((id: string, title: string) => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }
    setConversations((current) =>
      current.map((item) => (item.id === id ? { ...item, title: nextTitle.slice(0, 80) } : item)),
    );
  }, []);

  const setConversationModel = useCallback((id: string, model: string) => {
    setConversations((current) =>
      current.map((item) => (item.id === id ? { ...item, model } : item)),
    );
  }, []);

  const updateSettings = useCallback((patch: Partial<ChatSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const addDocument = useCallback(
    async (file: File): Promise<{ ok: boolean; error?: string; document?: StoredDocument }> => {
      const invalid = fileValidationMessage(file);
      if (invalid) {
        return { ok: false, error: invalid };
      }
      try {
        const content = await readFileText(file);
        if (!content.trim()) {
          return { ok: false, error: "That file contains no readable text." };
        }
        const document = toDocument(file, content);
        setDocuments((current) => [document, ...current]);
        return { ok: true, document };
      } catch {
        return { ok: false, error: "That file could not be read. Try another file." };
      }
    },
    [],
  );

  const removeDocument = useCallback((id: string) => {
    setDocuments((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearDocuments = useCallback(() => {
    setDocuments([]);
  }, []);

  const queueAttachmentForChat = useCallback((document: StoredDocument) => {
    setQueuedAttachment(toAttachment(document));
  }, []);

  const clearQueuedAttachment = useCallback(() => setQueuedAttachment(null), []);

  const clearConversations = useCallback(() => {
    abortRef.current?.abort();
    setConversations([]);
    setActiveId(null);
    setErrors({});
  }, []);

  const exportData = useCallback(
    () =>
      JSON.stringify(
        { exportedAt: new Date().toISOString(), conversations, documents, settings },
        null,
        2,
      ),
    [conversations, documents, settings],
  );

  const dismissNotice = useCallback(() => setNotice(null), []);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? null,
    [conversations, activeId],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      user,
      conversations,
      documents,
      settings,
      activeId,
      ready,
      pending,
      errors,
      notice,
      activeConversation,
      queuedAttachment,
      queueAttachmentForChat,
      clearQueuedAttachment,
      selectConversation,
      sendMessage,
      regenerate,
      stopGeneration,
      deleteConversation,
      renameConversation,
      setConversationModel,
      updateSettings,
      addDocument,
      removeDocument,
      clearDocuments,
      clearConversations,
      exportData,
      dismissNotice,
    }),
    [
      user,
      conversations,
      documents,
      settings,
      activeId,
      ready,
      pending,
      errors,
      notice,
      activeConversation,
      queuedAttachment,
      queueAttachmentForChat,
      clearQueuedAttachment,
      selectConversation,
      sendMessage,
      regenerate,
      stopGeneration,
      deleteConversation,
      renameConversation,
      setConversationModel,
      updateSettings,
      addDocument,
      removeDocument,
      clearDocuments,
      clearConversations,
      exportData,
      dismissNotice,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  }
  return context;
}
