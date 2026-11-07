"use client";

import { Check, Copy, FileText, RefreshCw } from "lucide-react";
import { useState } from "react";

import { NexaMark } from "@/components/brand/nexa-mark";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { Button } from "@/components/ui/button";
import { formatMessageTime } from "@/lib/workspace/format";
import { formatBytes } from "@/lib/workspace/documents";
import type { ChatMessage } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

interface MessageItemProps {
  message: ChatMessage;
  userInitials: string;
  showTimestamp: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
  pending: boolean;
}

export function MessageItem({
  message,
  userInitials,
  showTimestamp,
  canRegenerate,
  onRegenerate,
  pending,
}: MessageItemProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const isAssistant = message.role === "assistant";

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1_800);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <article
      className={cn("group/message flex gap-3", isAssistant ? "items-start" : "items-start justify-end")}
      aria-label={isAssistant ? "Nexa response" : "Your message"}
    >
      {isAssistant ? (
        <span className="mt-0.5 hidden shrink-0 sm:block">
          <NexaMark className="size-8" />
        </span>
      ) : null}

      <div className={cn("min-w-0 space-y-2", isAssistant ? "w-full max-w-3xl" : "max-w-[85%] sm:max-w-xl")}>
        {isAssistant ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Nexa</span>
            {message.model ? (
              <span className="rounded-full border border-border/70 px-1.5 py-0.5 font-mono text-[10px]">
                {message.model}
              </span>
            ) : null}
            {showTimestamp ? (
              <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
            ) : null}
          </div>
        ) : null}

        {message.attachments?.length ? (
          <ul className={cn("flex flex-wrap gap-1.5", !isAssistant && "justify-end")}>
            {message.attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2 py-1 text-[11px] text-muted-foreground"
                title={`${attachment.name} · ${formatBytes(attachment.size)}`}
              >
                <FileText className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{attachment.name}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {isAssistant ? (
          <div className="rounded-2xl rounded-tl-md border border-border/70 bg-card px-4 py-3 shadow-xs">
            <MessageMarkdown content={message.content} />
          </div>
        ) : (
          <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-primary-foreground shadow-sm">
            {message.content || "Attached a file."}
          </div>
        )}

        {isAssistant ? (
          <div className="flex flex-wrap items-center gap-1">
            <Button variant="ghost" size="xs" onClick={copy} aria-label="Copy response">
              {copyState === "copied" ? (
                <Check className="text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : (
                <Copy aria-hidden />
              )}
              {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}
            </Button>
            {canRegenerate ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={onRegenerate}
                disabled={pending}
                aria-label="Regenerate response"
              >
                <RefreshCw className={pending ? "animate-spin" : undefined} aria-hidden />
                Regenerate
              </Button>
            ) : null}
            <span className="sr-only" role="status">
              {copyState === "copied" ? "Response copied to clipboard" : ""}
            </span>
          </div>
        ) : showTimestamp ? (
          <p className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground/70">{userInitials}</span>
            <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
          </p>
        ) : null}
      </div>

      {!isAssistant && message.role === "user" ? (
        <span className="mt-0.5 hidden size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground sm:flex">
          {userInitials}
        </span>
      ) : null}

    </article>
  );
}
