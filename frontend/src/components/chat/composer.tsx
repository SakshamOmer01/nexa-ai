"use client";

import {
  ArrowUp,
  FileText,
  FolderOpen,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  Square,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useVoiceInput } from "@/lib/hooks/use-voice-input";
import { MAX_ATTACHMENTS } from "@/lib/workspace/chat";
import { formatBytes } from "@/lib/workspace/documents";
import type { MessageAttachment, StoredDocument } from "@/lib/workspace/types";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  attachments: MessageAttachment[];
  onRemoveAttachment: (id: string) => void;
  onUploadFile: (file: File) => Promise<{ ok: boolean; error?: string; attachment?: MessageAttachment }>;
  onAttachDocument: (document: StoredDocument) => void;
  documents: StoredDocument[];
  pending: boolean;
  sendOnEnter: boolean;
  placeholder: string;
  disabled?: boolean;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  attachments,
  onRemoveAttachment,
  onUploadFile,
  onAttachDocument,
  documents,
  pending,
  sendOnEnter,
  placeholder,
  disabled = false,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const voice = useVoiceInput((transcript) => {
    onChange(value ? `${value.trimEnd()} ${transcript}` : transcript);
    requestAnimationFrame(() => textareaRef.current?.focus());
  });

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) {
      return;
    }
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [value]);

  const canSend = !disabled && !pending && (value.trim().length > 0 || attachments.length > 0);

  function submit() {
    if (!canSend) {
      return;
    }
    onSubmit();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }
    const wantsSend = sendOnEnter
      ? event.key === "Enter" && !event.shiftKey
      : event.key === "Enter" && (event.metaKey || event.ctrlKey);
    if (wantsSend) {
      event.preventDefault();
      submit();
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setUploading(true);
    setUploadError(null);
    const result = await onUploadFile(file);
    setUploading(false);
    if (!result.ok) {
      setUploadError(result.error ?? "That file could not be attached.");
    }
  }

  const atLimit = attachments.length >= MAX_ATTACHMENTS;

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-border/80 bg-card p-2 shadow-lg shadow-primary/5 transition-colors focus-within:border-primary/40 focus-within:ring-3 focus-within:ring-ring/15">
        {attachments.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5 px-1 pt-1 pb-2" aria-label="Attachments">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/70 bg-muted/60 px-2 py-1 text-[11px]"
              >
                <FileText className="size-3 shrink-0 text-primary" aria-hidden />
                <span className="max-w-40 truncate" title={attachment.name}>
                  {attachment.name}
                </span>
                <span className="text-muted-foreground">{formatBytes(attachment.size)}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(attachment.id)}
                  className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={`Remove ${attachment.name}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <label htmlFor="composer" className="sr-only">
          Message Nexa
        </label>
        <textarea
          id="composer"
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          maxLength={8_000}
          disabled={disabled}
          className="max-h-50 min-h-[2.5rem] w-full resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
        />

        <div className="flex items-end justify-between gap-2 px-1 pt-1">
          <div className="flex items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Add attachment"
                  disabled={disabled || pending || uploading}
                >
                  {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Add context</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => fileInputRef.current?.click()}
                  disabled={atLimit}
                >
                  <Paperclip aria-hidden />
                  Upload a file
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setDocumentsOpen(true)}
                  disabled={atLimit}
                >
                  <FolderOpen aria-hidden />
                  From documents
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <p className="px-2.5 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
                  Text, Markdown, CSV, JSON and source files up to 1 MB. Files are read locally.
                </p>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={voice.toggle}
              disabled={disabled || pending}
              aria-label={voice.listening ? "Stop voice input" : "Start voice input"}
              aria-pressed={voice.listening}
              className={voice.listening ? "text-primary" : undefined}
            >
              <Mic className={voice.listening ? "animate-pulse" : undefined} aria-hidden />
            </Button>

            <span className="ml-1 hidden items-center gap-1.5 rounded-full border border-border/70 px-2 py-1 text-[10px] text-muted-foreground sm:inline-flex">
              <Paperclip className="size-3" aria-hidden />
              {attachments.length}/{MAX_ATTACHMENTS}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-[10px] text-muted-foreground md:inline">
              {sendOnEnter ? "Enter to send · Shift + Enter for a new line" : "⌘/Ctrl + Enter to send"}
            </span>
            {pending ? (
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={onStop}
                aria-label="Stop generating"
                className="rounded-full"
              >
                <Square aria-hidden />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon-sm"
                onClick={submit}
                disabled={!canSend}
                aria-label="Send message"
                className="rounded-full"
              >
                <ArrowUp aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1" aria-live="polite">
        {voice.listening ? (
          <p className="px-2 text-[11px] text-primary">Listening… speak, then press Enter to send.</p>
        ) : null}
        {voice.message ? (
          <p role="alert" className="px-2 text-[11px] text-destructive">
            {voice.message}
          </p>
        ) : null}
        {uploadError ? (
          <p role="alert" className="px-2 text-[11px] text-destructive">
            {uploadError}
          </p>
        ) : null}
        <p className="px-2 text-[10px] text-muted-foreground">
          Nexa can make mistakes. Verify important answers.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        accept=".txt,.md,.markdown,.csv,.json,.tsv,.log,.yml,.yaml,.html,.css,.js,.jsx,.ts,.tsx,.py,text/*,application/json"
        onChange={handleFile}
        tabIndex={-1}
        aria-hidden
      />

      <Dialog open={documentsOpen} onOpenChange={setDocumentsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach a document</DialogTitle>
            <DialogDescription>
              Only the selected file&apos;s text is added to this message. Nothing is uploaded.
            </DialogDescription>
          </DialogHeader>
          {documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <FolderOpen className="mx-auto size-5 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-xs text-muted-foreground">
                Your document library is empty.
              </p>
              <Button variant="outline" size="sm" asChild className="mt-3">
                <Link href="/documents" onClick={() => setDocumentsOpen(false)}>
                  Add a document
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="nexa-scroll max-h-72 space-y-1 overflow-y-auto">
              {documents.map((document) => (
                <li key={document.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onAttachDocument(document);
                      setDocumentsOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{document.name}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {formatBytes(document.size)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
