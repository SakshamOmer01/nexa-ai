import { newId } from "@/lib/workspace/chat";
import type { MessageAttachment, StoredDocument } from "@/lib/workspace/types";

/** Text formats we can extract in the browser without shipping a parser or a native dependency. */
export const ACCEPTED_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".tsv",
  ".log",
  ".yml",
  ".yaml",
  ".html",
  ".css",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
] as const;

export const MAX_FILE_BYTES = 1024 * 1024;
/** Hard cap on stored document text so one file cannot exhaust localStorage. */
export const MAX_DOCUMENT_CHARS = 200_000;

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export function isSupportedFile(file: Pick<File, "name" | "type" | "size">): boolean {
  if (file.size > MAX_FILE_BYTES || file.size === 0) {
    return false;
  }
  if ((ACCEPTED_EXTENSIONS as readonly string[]).includes(fileExtension(file.name))) {
    return true;
  }
  return file.type.startsWith("text/") || file.type === "application/json";
}

export function fileValidationMessage(
  file: Pick<File, "name" | "size" | "type">,
): string | null {
  if (file.size === 0) {
    return "That file is empty.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "Files must be 1 MB or smaller.";
  }
  if (!isSupportedFile(file)) {
    return "Unsupported file type. Upload a text, Markdown, CSV, JSON or source file.";
  }
  return null;
}

export async function readFileText(file: File): Promise<string> {
  const text = await file.text();
  return text.slice(0, MAX_DOCUMENT_CHARS);
}

export function toDocument(
  file: Pick<File, "name" | "type" | "size">,
  content: string,
  origin: StoredDocument["origin"] = "upload",
  now = new Date(),
): StoredDocument {
  return {
    id: newId(),
    name: file.name,
    mimeType: file.type || "text/plain",
    size: file.size,
    content: content.slice(0, MAX_DOCUMENT_CHARS),
    createdAt: now.toISOString(),
    origin,
  };
}

export function toAttachment(document: StoredDocument): MessageAttachment {
  return {
    id: newId(),
    name: document.name,
    mimeType: document.mimeType,
    size: document.size,
    content: document.content,
    kind: "text",
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
