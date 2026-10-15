import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDocuments, type Document } from "@/hooks/useDocuments";
import { toast } from "sonner";
import { Trash2, Loader2, Upload, Camera, AlertTriangle, FileText } from "lucide-react";
import { SuggestionsModal, type SuggestedUpdates } from "./SuggestionsModal";
import { maybeResizeImage } from "@/lib/resizeImage";
import { isDemoMode } from "@/demo/isDemoMode";
import { SAMPLE_DOCUMENTS, type SampleDocument } from "@/demo/samples";
import { DEMO_DOCUMENT_TEXT_LIMIT } from "@/demo/limits";

const SAMPLE_LABELS: Record<SampleDocument["id"], string> = {
  "lab-report": "Lab report",
  "visit-note": "Visit note",
};

const ACCEPTED = ".pdf,.txt,.md,.png,.jpg,.jpeg,.docx,.xlsx,.csv";
const ACCEPT_MIME = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

type DocType = "" | "Lab panel" | "Imaging report" | "Doctor's note" | "Prescription" | "Other";
const DOC_TYPE_OPTIONS: DocType[] = [
  "Lab panel",
  "Imaging report",
  "Doctor's note",
  "Prescription",
  "Other",
];

type HealthChecks = {
  anthropic_key: boolean;
  app_password: boolean;
  supabase_url: boolean;
  service_role: boolean;
  bucket: boolean;
  realtime_documents: boolean;
  realtime_lab_results: boolean;
};

const CHECK_LABELS: Record<keyof HealthChecks, string> = {
  anthropic_key: "Anthropic API key",
  app_password: "Password (server)",
  supabase_url: "Supabase URL",
  service_role: "Service-role key",
  bucket: "'medical-documents' bucket",
  realtime_documents: "Realtime on documents",
  realtime_lab_results: "Realtime on lab_results",
};

type IngestError = { code?: string; message?: string; hint?: string | null };

function extractIngestError(
  payload: unknown,
  fallback: string,
): { message: string; hint: string | null } {
  const p = payload as { error?: IngestError | string } | null;
  const e = p?.error;
  if (e && typeof e === "object") {
    return { message: e.message ?? fallback, hint: e.hint ?? null };
  }
  if (typeof e === "string") return { message: e, hint: null };
  return { message: fallback, hint: null };
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: Document["status"] }) {
  const map = {
    pending: "bg-stone-100 text-stone-600",
    processing: "bg-amber-100 text-amber-800",
    indexed: "bg-emerald-100 text-emerald-800",
    error: "bg-rose-100 text-rose-800",
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${map[status]}`}>
      {status}
    </span>
  );
}

export function RecordsPanel({
  password,
  onApplied,
}: {
  password: string;
  onApplied?: () => void;
}) {
  const { documents, refresh } = useDocuments();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<{
    filename: string;
    documentId: string;
    updates: SuggestedUpdates;
  } | null>(null);

  // Per-batch context — same values applied to all files in a single upload event.
  const [documentType, setDocumentType] = useState<DocType>("");
  const [testDate, setTestDate] = useState<string>("");
  const [contextNote, setContextNote] = useState<string>("");

  // Health check — surfaces missing secrets/bucket/realtime as a warning banner.
  const [healthChecks, setHealthChecks] = useState<HealthChecks | null>(null);
  const [healthCheckFailed, setHealthCheckFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("ingest-document", {
          body: { action: "health-check", password },
        });
        if (cancelled) return;
        if (error) {
          setHealthCheckFailed(error.message ?? "Health check request failed");
          return;
        }
        const checks = (data as { checks?: HealthChecks })?.checks;
        if (checks) setHealthChecks(checks);
        else setHealthCheckFailed("Health check returned an unexpected response");
      } catch (e) {
        if (!cancelled) setHealthCheckFailed((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [password]);

  const failingChecks: Array<keyof HealthChecks> = healthChecks
    ? (Object.keys(healthChecks) as Array<keyof HealthChecks>).filter((k) => !healthChecks[k])
    : [];

  const upload = useCallback(
    async (
      file: File,
      ctx: { document_type: string; context_note: string; test_date: string },
      sampleId?: SampleDocument["id"],
    ) => {
      if (
        !ACCEPT_MIME.includes(file.type) &&
        !file.name.match(/\.(pdf|txt|md|png|jpg|jpeg|docx|xlsx|csv)$/i)
      ) {
        toast.error("Unsupported file type");
        return;
      }

      // Client-side resize for oversized phone photos so the Claude payload stays sane.
      const prepared = await maybeResizeImage(file);

      setUploading(true);
      try {
        const { data: urlData, error: urlErr } = await supabase.functions.invoke(
          "ingest-document",
          {
            body: {
              action: "upload-url",
              password,
              filename: prepared.name,
              mime_type: prepared.type || "application/octet-stream",
              size_bytes: prepared.size,
            },
          },
        );
        if (urlErr || !urlData?.ok) {
          const { message, hint } = extractIngestError(
            urlData,
            urlErr?.message ?? "Could not get upload URL",
          );
          throw Object.assign(new Error(message), { hint });
        }

        // Demo mode keeps files in the browser: skip the storage PUT and hand the
        // processor the text of plain-text files directly.
        const isDemoUpload = String(urlData.upload_url).startsWith("demo://");
        let demoText: string | undefined;
        if (isDemoUpload) {
          if (prepared.type.startsWith("text/"))
            demoText = (await prepared.text()).slice(0, DEMO_DOCUMENT_TEXT_LIMIT);
        } else {
          const putRes = await fetch(urlData.upload_url, {
            method: "PUT",
            headers: { "Content-Type": prepared.type || "application/octet-stream" },
            body: prepared,
          });
          if (!putRes.ok) throw new Error(`Storage upload failed (${putRes.status})`);
        }

        toast.info(`Indexing "${prepared.name}"…`);

        const { data: procData, error: procErr } = await supabase.functions.invoke(
          "ingest-document",
          {
            body: {
              action: "process",
              password,
              document_id: urlData.document_id,
              document_type: ctx.document_type || undefined,
              context_note: ctx.context_note || undefined,
              test_date: ctx.test_date || undefined,
              demo_text: demoText,
              sample_id: sampleId,
            },
          },
        );
        if (procErr || !procData?.ok) {
          const { message, hint } = extractIngestError(
            procData,
            procErr?.message ?? "Processing failed",
          );
          throw Object.assign(new Error(message), { hint });
        }

        toast.success(`Indexed "${prepared.name}"`, {
          description: `${(procData.extracted_chars as number).toLocaleString()} characters extracted.`,
        });
        refresh();

        const updates = procData.suggested_updates as SuggestedUpdates | undefined;
        const hint = procData.hint as string | undefined;
        if (hint) toast.info(hint);
        if (updates) {
          const hasAny =
            (updates.psa_readings?.length ?? 0) +
              (updates.medications?.length ?? 0) +
              (updates.care_team?.length ?? 0) +
              (updates.plan_items?.length ?? 0) +
              (updates.lab_results?.length ?? 0) >
            0;
          if (hasAny) {
            setSuggestions({
              filename: prepared.name,
              documentId: urlData.document_id,
              updates,
            });
          }
        }
      } catch (e) {
        const err = e as Error & { hint?: string | null };
        toast.error(`Failed to upload "${file.name}"`, {
          description: err.hint ? `${err.message} — ${err.hint}` : err.message,
        });
      } finally {
        setUploading(false);
      }
    },
    [password, refresh],
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const ctx = { document_type: documentType, context_note: contextNote, test_date: testDate };
    for (const file of Array.from(files)) await upload(file, ctx);
    // Clear per-batch context so the next upload starts fresh.
    setDocumentType("");
    setTestDate("");
    setContextNote("");
  }

  async function trySample(sample: SampleDocument) {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${sample.url}`);
      if (!res.ok) throw new Error(`Sample not found (${res.status})`);
      const file = new File([await res.text()], sample.filename, { type: sample.mimeType });
      await upload(file, { document_type: "", context_note: "", test_date: "" }, sample.id);
    } catch (e) {
      toast.error("Could not load the sample", { description: (e as Error).message });
    }
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.name}"? The AI will no longer have access to it.`)) return;
    try {
      const { data, error } = await supabase.functions.invoke("ingest-document", {
        body: { action: "delete", password, document_id: doc.id },
      });
      if (error || !data?.ok) {
        const { message } = extractIngestError(data, error?.message ?? "Delete failed");
        throw new Error(message);
      }
      toast.success(`Deleted "${doc.name}"`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {suggestions && (
        <SuggestionsModal
          open
          filename={suggestions.filename}
          documentId={suggestions.documentId}
          suggestions={suggestions.updates}
          password={password}
          onClose={() => setSuggestions(null)}
          onApplied={() => {
            setSuggestions(null);
            onApplied?.();
          }}
        />
      )}

      {(failingChecks.length > 0 || healthCheckFailed) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-700 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-amber-900">Upload pipeline is not fully wired.</p>
            {healthCheckFailed ? (
              <p className="text-amber-800 mt-0.5">{healthCheckFailed}</p>
            ) : (
              <ul className="text-amber-800 mt-1 space-y-0.5 list-disc list-inside">
                {failingChecks.map((k) => (
                  <li key={k}>{CHECK_LABELS[k]}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-amber-700 mt-1.5">Uploads may fail until these are fixed.</p>
          </div>
        </div>
      )}

      {isDemoMode(import.meta.env) && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-stone-900">Try a sample document</p>
            <p className="text-xs text-stone-600 mt-0.5">
              Fictional documents with updates already read out, so no API key is needed. Review the
              suggestions, accept some, and see them land in the dashboard and Edit history. Your
              own files are read by Claude when you add a key in chat.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_DOCUMENTS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                disabled={uploading}
                onClick={() => trySample(sample)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-teal-200 text-sm font-medium text-stone-800 hover:bg-teal-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <FileText size={15} className="text-teal-600" />
                {SAMPLE_LABELS[sample.id]}
                <span className="text-xs font-normal text-stone-500">{sample.filename}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Per-batch context */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-stone-900">About this upload</p>
          <p className="text-xs text-stone-400">applies to all files in this batch</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-stone-600 mb-1">Document type</span>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocType)}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              <option value="">— pick one (optional) —</option>
              {DOC_TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-stone-600 mb-1">Test date</span>
            <input
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-stone-600 mb-1">
            Notes for extraction (optional)
          </span>
          <textarea
            rows={2}
            value={contextNote}
            onChange={(e) => setContextNote(e.target.value)}
            placeholder="e.g., 'Lab results from the spring visit' or 'post-radiation follow-up'"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </label>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        // Focusable so the keyboard (and the command palette's Upload action) can reach it.
        data-upload-dropzone
        role="group"
        aria-label="Upload documents"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            if (!uploading) inputRef.current?.click();
          }
        }}
        className={`relative overflow-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition min-h-[220px] sm:min-h-0 ${
          dragOver
            ? "border-teal-400 bg-teal-50/40"
            : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50"
        } ${uploading ? "opacity-70 cursor-not-allowed" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-stone-100 flex items-center justify-center">
              <Loader2 size={22} className="text-stone-500 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-700">Extracting and indexing…</p>
              <p className="text-xs text-stone-400 mt-0.5">Claude is reading the document</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center transition ${dragOver ? "bg-teal-100" : "bg-stone-100"}`}
            >
              <Upload size={20} className={dragOver ? "text-teal-600" : "text-stone-400"} />
            </div>
            <div>
              <p className="text-base sm:text-sm font-semibold text-stone-800">
                Drop files here or tap to upload
              </p>
              <p className="text-xs text-stone-400 mt-1">
                PDF · Word · Images · CSV · Text · up to 20 MB
              </p>
              <p className="text-xs text-stone-400 mt-0.5">
                Large phone photos are resized automatically
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                cameraInputRef.current?.click();
              }}
              className="sm:hidden mt-1 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium"
            >
              <Camera size={16} />
              Take photo
            </button>
          </div>
        )}
      </div>

      {/* Document list */}
      {documents.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl divide-y divide-stone-100">
          {documents.map((doc) => (
            <div key={doc.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-stone-900 truncate">{doc.name}</p>
                  <StatusBadge status={doc.status} />
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  {fmtSize(doc.size_bytes)}
                  {doc.extracted_chars > 0 &&
                    ` · ${doc.extracted_chars.toLocaleString()} chars indexed`}
                  {doc.status === "processing" && " · extracting text…"}
                </p>
                {doc.error && <p className="text-xs text-rose-700 mt-1">{doc.error}</p>}
              </div>
              <button
                onClick={() => handleDelete(doc)}
                className="shrink-0 p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 transition"
                aria-label={`Delete ${doc.name}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
