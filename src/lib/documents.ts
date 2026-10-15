// ABOUTME: Pure helpers for the Documents pages: a file's kind in words, its status as a chip, the
// ABOUTME: library's search and kind filter, and the size in KB or MB.
import type { ChipLevel } from "@/components/StatusChip";
import type { Document } from "@/hooks/useDocuments";
import { formatNumber } from "./format";

export type DocumentKind = { value: string; label: string };

export const DOCUMENT_KINDS: DocumentKind[] = [
  { value: "pdf", label: "PDF" },
  { value: "word", label: "Word" },
  { value: "spreadsheet", label: "Spreadsheet" },
  { value: "image", label: "Image" },
  { value: "text", label: "Text" },
  { value: "file", label: "Other file" },
];

const byValue = (value: string) => DOCUMENT_KINDS.find((k) => k.value === value)!;

/** What sort of file a document is, from its MIME type and then its extension. */
export function documentKind(doc: Pick<Document, "mime_type" | "name">): DocumentKind {
  const mime = doc.mime_type.toLowerCase();
  const ext = doc.name.toLowerCase().split(".").pop() ?? "";
  if (mime === "application/pdf" || ext === "pdf") return byValue("pdf");
  if (mime.includes("wordprocessingml") || ext === "docx") return byValue("word");
  if (mime.includes("spreadsheetml") || mime === "text/csv" || ["xlsx", "csv"].includes(ext))
    return byValue("spreadsheet");
  if (mime.startsWith("image/")) return byValue("image");
  if (mime.startsWith("text/") || ["txt", "md"].includes(ext)) return byValue("text");
  return byValue("file");
}

const STATUS: Record<Document["status"], { level: ChipLevel; label: string }> = {
  indexed: { level: "stable", label: "Ready" },
  processing: { level: "watch", label: "Reading" },
  pending: { level: "neutral", label: "Waiting" },
  error: { level: "act", label: "Failed" },
};

export function documentStatus(status: Document["status"]): { level: ChipLevel; label: string } {
  return STATUS[status] ?? STATUS.pending;
}

/** Documents whose name contains `q` (any case) and, when given, of the `kind` filter value. */
export function filterDocuments<T extends Pick<Document, "mime_type" | "name">>(
  docs: T[],
  { q = "", kind = "" }: { q?: string; kind?: string },
): T[] {
  const needle = q.trim().toLowerCase();
  return docs.filter(
    (d) =>
      (!needle || d.name.toLowerCase().includes(needle)) &&
      (!kind || documentKind(d).value === kind),
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${formatNumber(bytes / (1024 * 1024), 1)} MB`;
}
