"use client";

import { ArrowRight, Code2, MessagesSquare, Plus, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { NexaMark } from "@/components/brand/nexa-mark";
import { Composer } from "@/components/chat/composer";
import { MessageItem } from "@/components/chat/message-item";
import { ModelSelect } from "@/components/chat/model-select";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { useModels } from "@/lib/hooks/use-models";
import { MAX_ATTACHMENTS } from "@/lib/workspace/chat";
import { toAttachment } from "@/lib/workspace/documents";
import { initials } from "@/lib/workspace/format";
import { useWorkspace } from "@/lib/workspace/provider";
import type { ChatMode, MessageAttachment, StoredDocument } from "@/lib/workspace/types";

const SUGGESTIONS: Record<ChatMode, Array<{ title: string; prompt: string }>> = {
  chat: [
    {
      title: "Summarise a document",
      prompt: "Summarise the key points of an attached document and list any open questions.",
    },
    {
      title: "Plan a week of focus",
      prompt: "Help me plan a focused work week around three priorities. Ask what my priorities are first.",
    },
    {
      title: "Explain a concept",
      prompt: "Explain how refresh-token rotation works, with a concrete example and common pitfalls.",
    },
    {
      title: "Turn notes into a brief",
      prompt: "Turn my messy notes into a clear one-page brief with a summary and next steps.",
    },
  ],
  code: [
    {
      title: "Debug a stack trace",
      prompt: "Help me debug this stack trace. I will paste it next; ask for the surrounding code if needed.",
    },
    {
      title: "Write a tested hook",
      prompt: "Write a reusable React hook for debounced search with tests, in TypeScript.",
    },
    {
      title: "Review a query",
      prompt: "Review a SQL query for correctness and performance. I will paste the schema and query next.",
    },
    {
      title: "Refactor safely",
      prompt: "Refactor a Python function for readability without changing behaviour, and list the tests to run.",
    },
  ],
};

const EMPTY_COPY: Record<ChatMode, { heading: string; description: string }> = {
  chat: {
    heading: "What should we work through?",
    description:
      "Ask a question, bring a document, or think out loud. Your history stays in this browser.",
  },
  code: {
    heading: "What are we building?",
    description:
      "Paste a stack trace, describe a refactor, or ask for a tested implementation. Code answers come with language-labelled blocks.",
  },
};

export function ChatWorkspace({ mode }: { mode: ChatMode }) {
  const {
    user,
    ready,
    activeConversation,
    settings,
    documents,
    pending,
    errors,
    selectConversation,
    sendMessage,
    regenerate,
    stopGeneration,
    setConversationModel,
    addDocument,
    queuedAttachment,
    clearQueuedAttachment,
  } = useWorkspace();

  const { state: modelsState, retry: retryModels } = useModels();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [draftModel, setDraftModel] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversation = activeConversation?.mode === mode ? activeConversation : null;
  const messages = conversation?.messages ?? [];
  const isGenerating = Boolean(
    conversation && pending?.conversationId === conversation.id,
  );
  const conversationError = conversation ? errors[conversation.id] : undefined;

  const catalog = modelsState.phase === "ready" ? modelsState.data : null;
  const models = catalog?.models ?? [];
  const resolvedModel =
    conversation?.model || draftModel || settings.defaultModel || catalog?.defaultModel || models[0]?.id || "";
  const modelsUnavailable = modelsState.phase === "error";

  // A document sent over from the library joins the composer without being copied into local state.
  // Only the chat surface consumes it, so the coding view cannot silently pick up a stray file.
  const composerAttachments = useMemo(() => {
    if (!queuedAttachment || mode !== "chat") {
      return attachments;
    }
    if (attachments.some((item) => item.id === queuedAttachment.id)) {
      return attachments;
    }
    return attachments.length >= MAX_ATTACHMENTS
      ? attachments
      : [...attachments, queuedAttachment];
  }, [attachments, queuedAttachment, mode]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length, isGenerating]);

  const resetDraft = useCallback(() => {
    selectConversation(null);
    setInput("");
    setAttachments([]);
    clearQueuedAttachment();
  }, [selectConversation, clearQueuedAttachment]);

  async function handleSend() {
    if (!resolvedModel) {
      return;
    }
    const text = input;
    const files = composerAttachments;
    setInput("");
    setAttachments([]);
    clearQueuedAttachment();
    await sendMessage({ text, attachments: files, mode, model: resolvedModel });
  }

  function applySuggestion(prompt: string) {
    setInput(prompt);
    requestAnimationFrame(() => document.getElementById("composer")?.focus());
  }

  async function handleUpload(
    file: File,
  ): Promise<{ ok: boolean; error?: string; attachment?: MessageAttachment }> {
    if (composerAttachments.length >= MAX_ATTACHMENTS) {
      return { ok: false, error: `Attach up to ${MAX_ATTACHMENTS} files per message.` };
    }
    const result = await addDocument(file);
    if (!result.ok || !result.document) {
      return { ok: false, error: result.error ?? "That file could not be attached." };
    }
    const attachment = toAttachment(result.document);
    setAttachments((current) => [...current, attachment]);
    return { ok: true, attachment };
  }

  function attachDocument(document: StoredDocument) {
    if (composerAttachments.length >= MAX_ATTACHMENTS) {
      return;
    }
    if (composerAttachments.some((item) => item.name === document.name && item.size === document.size)) {
      return;
    }
    setAttachments((current) => [...current, toAttachment(document)]);
  }

  if (!ready) {
    return <ChatSkeleton />;
  }

  const copy = EMPTY_COPY[mode];
  const userInitials = initials(user.full_name, user.email);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col lg:h-dvh">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-4 py-2.5 backdrop-blur-xl sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="hidden size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
            {mode === "code" ? (
              <Code2 className="size-4" aria-hidden />
            ) : (
              <MessagesSquare className="size-4" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">
              {conversation?.title ?? (mode === "code" ? "New coding session" : "New chat")}
            </h1>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              {mode === "code" ? "Coding assistant" : "Nexa AI chat"} ·{" "}
              {isGenerating ? "Generating…" : conversation ? `${messages.length} messages` : "Ready"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <ModelSelect
            models={models}
            value={resolvedModel}
            onChange={(model) =>
              conversation ? setConversationModel(conversation.id, model) : setDraftModel(model)
            }
            disabled={models.length === 0 || isGenerating}
            provider={catalog?.provider}
            compact
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetDraft}
            className="rounded-full"
          >
            <Plus aria-hidden />
            <span className="hidden sm:inline">New</span>
          </Button>
        </div>
      </header>

      {catalog && !catalog.configured ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[11px] text-amber-700 dark:text-amber-300 sm:px-6">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
          <span className="font-medium">No AI provider is connected.</span>
          <span>
            Set <code className="font-mono">AI_API_KEY</code> on the server to receive real answers.
          </span>
          <Link
            href={`${siteConfig.githubUrl}/blob/main/frontend/README.md#ai-provider`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
          >
            Setup guide
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>
      ) : null}

      {modelsUnavailable ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-[11px] text-destructive sm:px-6"
        >
          <TriangleAlert className="size-3.5" aria-hidden />
          <span>{modelsState.phase === "error" ? modelsState.message : "Models could not load."}</span>
          <Button variant="ghost" size="xs" onClick={retryModels} className="text-destructive">
            Retry
          </Button>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="nexa-scroll min-h-0 flex-1 overflow-y-auto"
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
        aria-relevant="additions text"
      >
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          {!conversation || messages.length === 0 ? (
            <div className="animate-fade-in flex min-h-[46vh] flex-col justify-center py-6">
              <div className="mx-auto max-w-xl text-center">
                <div className="relative mx-auto mb-5 flex size-14 items-center justify-center">
                  <span
                    className="absolute inset-0 rounded-2xl bg-linear-to-br from-brand-blue/20 to-brand-violet/25 blur-md"
                    aria-hidden
                  />
                  <NexaMark className="relative size-11" />
                </div>
                <h2 className="text-balance text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
                  {copy.heading}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {copy.description}
                </p>
              </div>

              <div className="mx-auto mt-7 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS[mode].map((suggestion) => (
                  <button
                    key={suggestion.title}
                    type="button"
                    onClick={() => applySuggestion(suggestion.prompt)}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    <span className="text-xs font-medium">{suggestion.title}</span>
                    <ArrowRight
                      className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden
                    />
                  </button>
                ))}
              </div>

              <p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <Sparkles className="size-3" aria-hidden />
                Answers come from your configured provider — Nexa never fabricates a reply.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  userInitials={userInitials}
                  showTimestamp={settings.showTimestamps}
                  canRegenerate={
                    message.role === "assistant" &&
                    index === messages.length - 1 &&
                    !isGenerating
                  }
                  onRegenerate={() => conversation && regenerate(conversation.id)}
                  pending={isGenerating}
                />
              ))}

              {isGenerating ? (
                <div className="flex items-start gap-3" role="status" aria-label="Nexa is thinking">
                  <span className="mt-0.5 hidden sm:block">
                    <NexaMark className="size-8" />
                  </span>
                  <div className="rounded-2xl rounded-tl-md border border-border/70 bg-card px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 animate-blink rounded-full bg-primary" />
                      <span className="size-1.5 animate-blink rounded-full bg-primary [animation-delay:150ms]" />
                      <span className="size-1.5 animate-blink rounded-full bg-primary [animation-delay:300ms]" />
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        Nexa is thinking…
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {conversationError ? (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-xs text-destructive"
                >
                  <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 leading-relaxed">{conversationError}</span>
                  {conversation ? (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => void regenerate(conversation.id)}
                      disabled={isGenerating}
                    >
                      Try again
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/60 bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            onStop={stopGeneration}
            attachments={composerAttachments}
            onRemoveAttachment={(id) => {
              if (queuedAttachment?.id === id) {
                clearQueuedAttachment();
                return;
              }
              setAttachments((current) => current.filter((item) => item.id !== id));
            }}
            onUploadFile={handleUpload}
            onAttachDocument={attachDocument}
            documents={documents}
            pending={isGenerating}
            sendOnEnter={settings.sendOnEnter}
            placeholder={
              mode === "code" ? "Describe what you want to build or debug…" : "Ask Nexa anything…"
            }
            disabled={!resolvedModel}
          />
        </div>
      </div>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-dvh" aria-busy="true" aria-live="polite">
      <div className="flex h-14 items-center justify-between border-b border-border/70 px-6">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-7 w-32 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-8">
        <div className="h-20 w-2/3 animate-pulse rounded-2xl bg-muted/60" />
        <div className="ml-auto h-14 w-1/2 animate-pulse rounded-2xl bg-muted/40" />
        <div className="h-24 w-4/5 animate-pulse rounded-2xl bg-muted/50" />
      </div>
      <div className="px-6 pb-4">
        <div className="mx-auto h-24 w-full max-w-3xl animate-pulse rounded-2xl bg-muted/60" />
      </div>
      <span className="sr-only">Loading conversation…</span>
    </div>
  );
}
