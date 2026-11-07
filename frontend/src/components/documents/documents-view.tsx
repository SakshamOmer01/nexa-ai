"use client";

import {
  Check,
  Copy,
  FileText,
  FolderOpen,
  Loader2,
  MessageSquare,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";

import { PageHeader } from "@/components/workspace/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/workspace/documents";
import { formatDay } from "@/lib/workspace/format";
import { useWorkspace } from "@/lib/workspace/provider";
import type { StoredDocument } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

type OriginFilter = "all" | "upload" | "chat";

const FILTERS: Array<{ value: OriginFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "upload", label: "Uploaded" },
  { value: "chat", label: "From chat" },
];

export function DocumentsView() {
  const router = useRouter();
  const { documents, ready, addDocument, removeDocument, queueAttachmentForChat } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OriginFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<StoredDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoredDocument | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const needle = query.trim().toLowerCase();
  const filtered = documents.filter((document) => {
    if (filter !== "all" && document.origin !== filter) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return (
      document.name.toLowerCase().includes(needle) ||
      document.content.toLowerCase().includes(needle)
    );
  });

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setUploading(true);
    setError(null);
    const result = await addDocument(file);
    setUploading(false);
    if (!result.ok) {
      setError(result.error ?? "That file could not be added.");
    }
  }

  function openInChat(document: StoredDocument) {
    queueAttachmentForChat(document);
    router.push("/chat");
  }

  async function copyPreview() {
    if (!preview) {
      return;
    }
    try {
      await navigator.clipboard.writeText(preview.content);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1_800);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        icon={FolderOpen}
        eyebrow="Library"
        title="Documents"
        description="Keep the reference material you use with Nexa. Files are read in your browser, stored with your account's workspace, and attached to a message only when you choose."
        actions={
          <>
            <Badge variant="outline" className="hidden sm:inline-flex">
              {documents.length} {documents.length === 1 ? "document" : "documents"}
            </Badge>
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
              {uploading ? "Reading…" : "Upload document"}
            </Button>
          </>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        accept=".txt,.md,.markdown,.csv,.json,.tsv,.log,.yml,.yaml,.html,.css,.js,.jsx,.ts,.tsx,.py,text/*,application/json"
        onChange={handleUpload}
        tabIndex={-1}
        aria-hidden
      />

      <div
        role="alert"
        aria-live="polite"
        className={cn(
          "mt-4 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive",
          error ? "block" : "hidden",
        )}
      >
        {error}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents"
            aria-label="Search documents"
            className="pl-8"
          />
        </div>
        <div
          role="group"
          aria-label="Filter documents by origin"
          className="flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 p-0.5"
        >
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                filter === option.value
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {!ready ? (
          <div className="space-y-2" aria-busy="true" aria-live="polite">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-16 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-sm font-semibold">
              {documents.length === 0 ? "Your library is empty" : "No matching documents"}
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              {documents.length === 0
                ? "Upload a text, Markdown, CSV, JSON or source file to use it as context in chat."
                : "Try a different search term or filter."}
            </p>
            {documents.length === 0 ? (
              <Button variant="outline" className="mt-4" onClick={() => fileInputRef.current?.click()}>
                <Upload aria-hidden />
                Choose a file
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card">
            {filtered.map((document) => (
              <li
                key={document.id}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={document.name}>
                    {document.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>{formatBytes(document.size)}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDay(document.createdAt)}</span>
                    <span aria-hidden>·</span>
                    <span>{document.origin === "chat" ? "From chat" : "Uploaded"}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setPreview(document)}>
                    Preview
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openInChat(document)}>
                    <MessageSquare aria-hidden />
                    <span className="hidden sm:inline">Use in chat</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(document)}
                    aria-label={`Delete ${document.name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={preview !== null} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-2">{preview?.name}</DialogTitle>
            <DialogDescription>
              {preview ? `${formatBytes(preview.size)} · ${formatDay(preview.createdAt)} · stored in this browser` : ""}
            </DialogDescription>
          </DialogHeader>
          <pre className="nexa-scroll max-h-72 overflow-auto rounded-xl border border-border/70 bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {preview?.content}
          </pre>
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" size="sm" onClick={copyPreview}>
              {copyState === "copied" ? (
                <Check className="text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : (
                <Copy aria-hidden />
              )}
              {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy text"}
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setPreview(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  if (preview) {
                    openInChat(preview);
                  }
                }}
              >
                <MessageSquare aria-hidden />
                Use in chat
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.name}” will be removed from this browser. Messages that already used it
              keep their copy of the text.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  removeDocument(deleteTarget.id);
                }
                setDeleteTarget(null);
                setPreview(null);
              }}
            >
              <Trash2 aria-hidden />
              Delete document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Supported: text, Markdown, CSV, JSON, YAML, HTML, CSS, JavaScript, TypeScript and Python,
        up to 1 MB. PDF and Office parsing are not enabled yet, so no fake extraction is shown.
      </p>
    </div>
  );
}
