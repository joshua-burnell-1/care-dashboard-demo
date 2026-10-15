// ABOUTME: The Documents upload pipeline: get an upload URL, send the file (or, in the demo, its
// ABOUTME: text), have it read, and hand back any suggested updates; plus samples and a setup check.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { SuggestedUpdates } from "@/components/dashboard/SuggestionsModal";
import { DEMO_DOCUMENT_TEXT_LIMIT } from "@/demo/limits";
import type { SampleDocument } from "@/demo/samples";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/format";
import { maybeResizeImage } from "@/lib/resizeImage";

export const ACCEPTED_FILES = ".pdf,.txt,.md,.png,.jpg,.jpeg,.docx,.xlsx,.csv";
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

/** Optional context the uploader gives for the files in one upload. */
export type UploadDetails = { document_type: string; test_date: string; context_note: string };
export const NO_DETAILS: UploadDetails = { document_type: "", test_date: "", context_note: "" };

/** A processed document with updates to review. */
export type PendingSuggestions = {
  filename: string;
  documentId: string;
  updates: SuggestedUpdates;
};

type HealthChecks = Record<string, boolean>;

const CHECK_LABELS: Record<string, string> = {
  anthropic_key: "Anthropic API key",
  app_password: "Password (server)",
  supabase_url: "Supabase URL",
  service_role: "Service-role key",
  bucket: "The medical-documents storage bucket",
  realtime_documents: "Realtime on documents",
  realtime_lab_results: "Realtime on lab results",
};

type IngestError = { code?: string; message?: string; hint?: string | null };

function ingestError(payload: unknown, fallback: string): Error & { hint: string | null } {
  const e = (payload as { error?: IngestError | string } | null)?.error;
  if (e && typeof e === "object") {
    return Object.assign(new Error(e.message ?? fallback), { hint: e.hint ?? null });
  }
  return Object.assign(new Error(typeof e === "string" ? e : fallback), { hint: null });
}

function countUpdates(u: SuggestedUpdates): number {
  return (
    (u.psa_readings?.length ?? 0) +
    (u.medications?.length ?? 0) +
    (u.care_team?.length ?? 0) +
    (u.plan_items?.length ?? 0) +
    (u.lab_results?.length ?? 0)
  );
}

export function useDocumentUpload({
  password,
  onUploaded,
  onSuggestions,
}: {
  password: string;
  /** Called after each file is read, so the library can refresh. */
  onUploaded: () => void;
  onSuggestions: (pending: PendingSuggestions) => void;
}) {
  const [uploading, setUploading] = useState(false);
  // What the server says is not set up, so uploads may fail: labels, or one failure message.
  const [healthIssues, setHealthIssues] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("ingest-document", {
          body: { action: "health-check", password },
        });
        if (cancelled) return;
        const checks = (data as { checks?: HealthChecks } | null)?.checks;
        if (error || !checks) {
          setHealthIssues([error?.message ?? "The setup check returned an unexpected response."]);
          return;
        }
        setHealthIssues(
          Object.keys(checks)
            .filter((k) => !checks[k])
            .map((k) => CHECK_LABELS[k] ?? k),
        );
      } catch (e) {
        if (!cancelled) setHealthIssues([(e as Error).message]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [password]);

  const upload = useCallback(
    async (file: File, details: UploadDetails, sampleId?: SampleDocument["id"]) => {
      if (
        !ACCEPT_MIME.includes(file.type) &&
        !/\.(pdf|txt|md|png|jpg|jpeg|docx|xlsx|csv)$/i.test(file.name)
      ) {
        toast.error(`${file.name} is not a supported file`, {
          description: "Use a PDF, Word, image, CSV, Markdown or text file.",
        });
        return;
      }
      // Oversized phone photos are shrunk so the extraction request stays a sane size.
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
          throw ingestError(urlData, urlErr?.message ?? "Could not start the upload");
        }

        // The demo keeps files in the browser: skip storage and send the text of text files.
        const isDemoUpload = String(urlData.upload_url).startsWith("demo://");
        let demoText: string | undefined;
        if (isDemoUpload) {
          if (prepared.type.startsWith("text/")) {
            demoText = (await prepared.text()).slice(0, DEMO_DOCUMENT_TEXT_LIMIT);
          }
        } else {
          const put = await fetch(urlData.upload_url, {
            method: "PUT",
            headers: { "Content-Type": prepared.type || "application/octet-stream" },
            body: prepared,
          });
          if (!put.ok) throw new Error(`The file could not be stored (${put.status})`);
        }

        const { data: procData, error: procErr } = await supabase.functions.invoke(
          "ingest-document",
          {
            body: {
              action: "process",
              password,
              document_id: urlData.document_id,
              document_type: details.document_type || undefined,
              context_note: details.context_note || undefined,
              test_date: details.test_date || undefined,
              demo_text: demoText,
              sample_id: sampleId,
            },
          },
        );
        if (procErr || !procData?.ok) {
          throw ingestError(procData, procErr?.message ?? "The document could not be read");
        }

        onUploaded();
        toast.success(`Added ${prepared.name}`, {
          description: `${formatNumber(procData.extracted_chars as number)} characters read.`,
        });
        const hint = procData.hint as string | undefined;
        if (hint) toast.info(hint);
        const updates = procData.suggested_updates as SuggestedUpdates | undefined;
        if (updates && countUpdates(updates) > 0) {
          onSuggestions({ filename: prepared.name, documentId: urlData.document_id, updates });
        }
      } catch (e) {
        const err = e as Error & { hint?: string | null };
        toast.error(`Could not add ${file.name}`, {
          description: err.hint ? `${err.message}. ${err.hint}` : err.message,
        });
      } finally {
        setUploading(false);
      }
    },
    [password, onUploaded, onSuggestions],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[] | null, details: UploadDetails) => {
      for (const file of Array.from(files ?? [])) await upload(file, details);
    },
    [upload],
  );

  const trySample = useCallback(
    async (sample: SampleDocument) => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}${sample.url}`);
        if (!res.ok) throw new Error(`Sample not found (${res.status})`);
        const file = new File([await res.text()], sample.filename, { type: sample.mimeType });
        await upload(file, NO_DETAILS, sample.id);
      } catch (e) {
        toast.error("Could not load the sample", { description: (e as Error).message });
      }
    },
    [upload],
  );

  return { uploading, healthIssues, uploadFiles, trySample };
}
