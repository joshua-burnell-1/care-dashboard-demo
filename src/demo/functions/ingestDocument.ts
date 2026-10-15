// ABOUTME: Demo version of the ingest-document edge function. Files never leave the
// ABOUTME: browser: the viewer's text is stored on the document row and indexed from there.

import type { SuggestedUpdates } from "@/components/dashboard/SuggestionsModal";
import { clearApiKey, getApiKey } from "../apiKey";
import type { DemoDb } from "../db";
import { emptyUpdates, ExtractionError, extractSuggestedUpdates } from "../extract";
import { DEMO_DOCUMENT_TEXT_LIMIT } from "../limits";
import { findSample } from "../samples";
import { ok, type Handler, type Row } from "./shared";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const CONTEXT_SEPARATOR = "\n\n---\n\n";
const NO_KEY_HINT = "Add an API key in chat to extract updates from your own files.";
const NO_TEXT_HINT = "Only text, Markdown and CSV files can be read for updates in this demo.";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

/** Structured error, as the real function returns it: `{ ok: false, error: { code, message, hint } }`. */
function errorJson(code: string, message: string, hint: string | null = null) {
  return { ok: false, error: { code, message, hint } };
}

function findDocument(db: DemoDb, id: unknown): Row | undefined {
  return db.all("documents").find((d) => d.id === id);
}

/** Rebuilds the cache context chat reads from, from the indexed documents. */
function indexedContext(db: DemoDb): string {
  return db
    .all("documents")
    .filter((d) => d.status === "indexed")
    .map((d) => `### ${d.name}\n${d.extracted_text ?? ""}`)
    .join(CONTEXT_SEPARATOR);
}

type CacheSource = { id: string } & Row;

/** Applies `edit` to the sources list and refreshes the context of medical_cache row 1, if present. */
function updateCache(db: DemoDb, edit: (sources: CacheSource[]) => CacheSource[], extra: Row = {}) {
  const cache = db.all("medical_cache").find((c) => c.id === 1);
  if (!cache) return;
  const sources = Array.isArray(cache.sources) ? (cache.sources as CacheSource[]) : [];
  db.upsert("medical_cache", {
    id: 1,
    sources: edit(sources),
    context: indexedContext(db),
    ...extra,
  });
}

function healthCheck() {
  return ok({
    checks: {
      anthropic_key: true,
      app_password: true,
      supabase_url: true,
      service_role: true,
      bucket: true,
      realtime_documents: true,
      realtime_lab_results: true,
    },
  });
}

function uploadUrl(db: DemoDb, body: Record<string, unknown>) {
  const filename = body.filename as string | undefined;
  const mime_type = body.mime_type as string | undefined;
  const size_bytes = body.size_bytes as number | undefined;

  if (!filename || !mime_type) return errorJson("MISSING_FIELDS", "Missing filename or mime_type.");
  if (!ALLOWED_MIME_TYPES.has(mime_type)) {
    return errorJson(
      "UNSUPPORTED_TYPE",
      `Unsupported file type: ${mime_type}.`,
      "Supported: PDF, PNG, JPG, WebP, DOCX, XLSX, CSV, TXT, MD.",
    );
  }
  if (size_bytes !== undefined && size_bytes > MAX_FILE_BYTES) {
    return errorJson(
      "FILE_TOO_LARGE",
      "File exceeds 20 MB limit.",
      "Please resize or split the file before uploading.",
    );
  }

  const ext = filename.includes(".") ? filename.split(".").pop() : "";
  const storage_path = `${crypto.randomUUID()}${ext ? "." + ext : ""}`;
  const doc = db.upsert("documents", {
    name: filename,
    mime_type,
    storage_path,
    size_bytes: size_bytes ?? 0,
    status: "pending",
    error: null,
    extracted_chars: 0,
    extracted_text: "",
  });
  return ok({
    upload_url: `demo://upload/${doc.id}`,
    storage_path,
    document_id: doc.id,
  });
}

/** Distinct non-empty values of one text column, for telling the model what already exists. */
function distinct(db: DemoDb, table: "lab_results" | "medication_items", column: string) {
  const values = db.all(table).map((r) => String(r[column] ?? "").trim());
  return [...new Set(values.filter(Boolean))];
}

function uploaderContext(body: Record<string, unknown>) {
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  return {
    documentType: str(body.document_type),
    testDate: str(body.test_date),
    note: str(body.context_note),
  };
}

/** Suggestions for a processed document, plus a hint when there are none worth waiting for. */
async function suggestUpdates(
  db: DemoDb,
  body: Record<string, unknown>,
  text: string,
): Promise<{ suggested_updates: SuggestedUpdates; hint?: string }> {
  const sample = findSample(body.sample_id);
  if (sample) return { suggested_updates: structuredClone(sample.precomputed) };

  const apiKey = getApiKey();
  if (!apiKey) return { suggested_updates: emptyUpdates(), hint: NO_KEY_HINT };
  if (!text) return { suggested_updates: emptyUpdates(), hint: NO_TEXT_HINT };

  try {
    const suggested_updates = await extractSuggestedUpdates(text, {
      apiKey,
      existing: {
        labs: distinct(db, "lab_results", "metric"),
        medications: distinct(db, "medication_items", "item"),
      },
      uploader: uploaderContext(body),
    });
    return { suggested_updates };
  } catch (e) {
    // A rejected key is useless everywhere, so forget it as chat does.
    if (e instanceof ExtractionError && e.code === "BAD_KEY") clearApiKey();
    // The document stays indexed for chat; the viewer just gets no suggestions and the reason.
    const hint = e instanceof Error ? e.message : "Could not extract updates from that file.";
    return { suggested_updates: emptyUpdates(), hint };
  }
}

async function processDocument(db: DemoDb, body: Record<string, unknown>) {
  const { document_id, demo_text } = body;
  if (!document_id) return errorJson("MISSING_FIELDS", "Missing document_id.");
  const doc = findDocument(db, document_id);
  if (!doc) return errorJson("DOCUMENT_NOT_FOUND", "Document not found.");

  // The file itself stays in the browser; only text the client chose to send is indexed.
  const raw = typeof demo_text === "string" ? demo_text : "";
  const truncated = raw.length > DEMO_DOCUMENT_TEXT_LIMIT;
  const extracted_text = truncated ? raw.slice(0, DEMO_DOCUMENT_TEXT_LIMIT) : raw;

  db.upsert("documents", {
    id: doc.id,
    status: "indexed",
    extracted_chars: extracted_text.length,
    extracted_text,
    error: null,
  });
  updateCache(
    db,
    (sources) => {
      const entry = {
        id: String(doc.id),
        name: doc.name,
        mimeType: doc.mime_type,
        modifiedTime: new Date().toISOString(),
        textChars: extracted_text.length,
        truncated,
        error: null,
      };
      const at = sources.findIndex((s) => s.id === doc.id);
      return at >= 0 ? sources.map((s, i) => (i === at ? entry : s)) : [...sources, entry];
    },
    { last_synced_at: new Date().toISOString(), last_error: null },
  );

  const { suggested_updates, hint } = await suggestUpdates(db, body, extracted_text);
  return ok({ extracted_chars: extracted_text.length, suggested_updates, ...(hint && { hint }) });
}

function deleteDocument(db: DemoDb, body: Record<string, unknown>) {
  const { document_id } = body;
  if (!document_id) return errorJson("MISSING_FIELDS", "Missing document_id.");
  const doc = findDocument(db, document_id);
  if (doc) {
    db.remove("documents", String(doc.id));
    updateCache(db, (sources) => sources.filter((s) => s.id !== doc.id));
  }
  return ok();
}

export const ingestDocument: Handler = (db, body) => {
  switch (body.action) {
    case "health-check":
      return healthCheck();
    case "upload-url":
      return uploadUrl(db, body);
    case "process":
      return processDocument(db, body);
    case "delete":
      return deleteDocument(db, body);
    default:
      return errorJson("UNKNOWN_ACTION", `Unknown action: ${body.action}.`);
  }
};
