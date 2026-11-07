import { describe, expect, it } from "vitest";

import {
  ACCEPTED_EXTENSIONS,
  MAX_DOCUMENT_CHARS,
  MAX_FILE_BYTES,
  fileExtension,
  fileValidationMessage,
  formatBytes,
  isSupportedFile,
  readFileText,
  toAttachment,
  toDocument,
} from "@/lib/workspace/documents";

const now = new Date("2026-11-07T12:00:00Z");

function file(name: string, content = "hello", type = "text/plain"): File {
  return new File([content], name, { type });
}

describe("file detection", () => {
  it("reads extensions case-insensitively", () => {
    expect(fileExtension("Notes.MD")).toBe(".md");
    expect(fileExtension("README")).toBe("");
  });

  it("accepts known extensions and text MIME types within the size cap", () => {
    for (const extension of ACCEPTED_EXTENSIONS) {
      expect(isSupportedFile({ name: `file${extension}`, type: "", size: 10 })).toBe(true);
    }
    expect(isSupportedFile({ name: "data.unknown", type: "text/plain", size: 10 })).toBe(true);
    expect(isSupportedFile({ name: "data.unknown", type: "application/json", size: 10 })).toBe(true);
    expect(isSupportedFile({ name: "image.png", type: "image/png", size: 10 })).toBe(false);
    expect(isSupportedFile({ name: "empty.txt", type: "text/plain", size: 0 })).toBe(false);
    expect(isSupportedFile({ name: "big.txt", type: "text/plain", size: MAX_FILE_BYTES + 1 })).toBe(
      false,
    );
  });

  it("explains each rejection", () => {
    expect(fileValidationMessage({ name: "empty.txt", size: 0, type: "text/plain" })).toBe(
      "That file is empty.",
    );
    expect(
      fileValidationMessage({ name: "big.txt", size: MAX_FILE_BYTES + 1, type: "text/plain" }),
    ).toBe("Files must be 1 MB or smaller.");
    expect(fileValidationMessage({ name: "image.png", size: 10, type: "image/png" })).toContain(
      "Unsupported file type",
    );
    expect(fileValidationMessage({ name: "notes.md", size: 10, type: "text/markdown" })).toBeNull();
  });

  it("reads text and clamps stored content", async () => {
    await expect(readFileText(file("notes.md", "# Hi"))).resolves.toBe("# Hi");
    const huge = file("huge.txt", "x".repeat(MAX_DOCUMENT_CHARS + 10));
    await expect(readFileText(huge)).resolves.toHaveLength(MAX_DOCUMENT_CHARS);
  });
});

describe("document conversion", () => {
  it("creates a stored document and a composer attachment", () => {
    const document = toDocument(file("notes.md", "abc"), "abc", "chat", now);
    expect(document).toMatchObject({
      name: "notes.md",
      mimeType: "text/plain",
      size: 3,
      content: "abc",
      origin: "chat",
      createdAt: now.toISOString(),
    });

    const attachment = toAttachment(document);
    expect(attachment).toMatchObject({ name: "notes.md", content: "abc", kind: "text" });
    expect(attachment.id).not.toBe(document.id);
  });

  it("falls back to text/plain for a missing MIME type", () => {
    expect(toDocument({ name: "a.txt", type: "", size: 1 }, "a").mimeType).toBe("text/plain");
  });

  it("formats byte counts at every scale", () => {
    expect(formatBytes(12)).toBe("12 B");
    expect(formatBytes(2_048)).toBe("2.0 KB");
    expect(formatBytes(20 * 1024)).toBe("20 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
