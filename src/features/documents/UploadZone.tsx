// ABOUTME: The Documents upload card: a drop area with a Browse button and a visible drop state,
// ABOUTME: optional details folded under "Add details", and the keyless sample documents.
import { useId, useRef, useState } from "react";
import { Camera, ChevronDown, FileText, Loader2, Upload } from "lucide-react";
import type { SampleDocument } from "@/demo/samples";
import { ACCEPTED_FILES, NO_DETAILS, type UploadDetails } from "./useDocumentUpload";

const DOC_TYPES = ["Lab panel", "Imaging report", "Doctor's note", "Prescription", "Other"];

const SAMPLE_LABELS: Record<SampleDocument["id"], string> = {
  "lab-report": "Lab report",
  "visit-note": "Visit note",
};

const BUTTON =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none";
const FIELD =
  "w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function UploadZone({
  uploading,
  onFiles,
  samples,
  onSample,
}: {
  uploading: boolean;
  onFiles: (files: FileList | null, details: UploadDetails) => Promise<void>;
  /** The keyless samples (demo only); omit to hide the row. */
  samples?: SampleDocument[];
  onSample: (sample: SampleDocument) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<UploadDetails>(NO_DETAILS);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const id = useId();

  async function take(files: FileList | null) {
    if (!files?.length) return;
    await onFiles(files, details);
    // Details describe one upload; the next starts fresh.
    setDetails(NO_DETAILS);
  }

  const browse = () => !uploading && fileRef.current?.click();
  const set = (patch: Partial<UploadDetails>) => setDetails((d) => ({ ...d, ...patch }));

  return (
    <section aria-label="Add a document" className="rounded-[20px] border border-line bg-surface">
      <div className="p-2">
        <div
          data-upload-dropzone
          data-dragging={dragging || undefined}
          role="group"
          aria-label="Upload documents"
          aria-busy={uploading || undefined}
          tabIndex={0}
          onClick={browse}
          onKeyDown={(e) => {
            if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              browse();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!dragging) setDragging(true);
          }}
          onDragLeave={(e) => {
            // Moving over a child fires dragleave on the parent; only leaving the area counts.
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!uploading) void take(e.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center rounded-[14px] border-2 border-dashed px-5 py-8 text-center transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none sm:py-10 ${
            dragging ? "border-ink bg-secondary" : "border-line hover:bg-secondary/50"
          } ${uploading ? "cursor-progress" : ""}`}
        >
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_FILES}
            multiple
            hidden
            onChange={(e) => {
              void take(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              void take(e.target.files);
              e.target.value = "";
            }}
          />
          <span
            aria-hidden
            className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border transition-colors duration-200 ease-out ${
              dragging ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink"
            }`}
          >
            {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
          </span>
          <p className="mt-4 font-display text-2xl leading-tight text-ink">
            {uploading
              ? "Reading the document…"
              : dragging
                ? "Drop to add it"
                : "Drag a document here"}
          </p>
          <p className="mt-1 max-w-lg text-sm text-muted">
            {uploading
              ? "Claude is reading it and looking for updates to suggest."
              : "PDF, Word, images, CSV or text, up to 20 MB. Phone photos are resized."}
          </p>
          {!uploading && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  browse();
                }}
                className={`${BUTTON} bg-ink text-paper hover:bg-ink/90`}
              >
                Browse files
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cameraRef.current?.click();
                }}
                className={`${BUTTON} border border-line bg-surface text-ink hover:bg-secondary sm:hidden`}
              >
                <Camera size={16} aria-hidden />
                Take photo
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line px-4 sm:px-5">
        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls={`${id}-details`}
          onClick={() => setDetailsOpen((o) => !o)}
          className="-mx-2 my-1.5 inline-flex h-10 items-center gap-2 rounded-xl px-2 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Add details
          <span className="font-normal text-muted">(optional)</span>
          <ChevronDown
            size={16}
            aria-hidden
            className={`transition-transform duration-200 ease-out motion-reduce:transition-none ${detailsOpen ? "rotate-180" : ""}`}
          />
        </button>
        <div id={`${id}-details`} hidden={!detailsOpen} className="pb-4">
          <p className="mb-3 text-sm text-muted">
            Helps Claude read the next upload. It applies to every file you add at once.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-type`} className="mb-1 block text-xs font-medium text-muted">
                Document type
              </label>
              <select
                id={`${id}-type`}
                value={details.document_type}
                onChange={(e) => set({ document_type: e.target.value })}
                className={`${FIELD} h-10`}
              >
                <option value="">Not sure</option>
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-date`} className="mb-1 block text-xs font-medium text-muted">
                Test date
              </label>
              <input
                id={`${id}-date`}
                type="date"
                value={details.test_date}
                onChange={(e) => set({ test_date: e.target.value })}
                className={`${FIELD} h-10`}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`${id}-note`} className="mb-1 block text-xs font-medium text-muted">
                Notes for Claude
              </label>
              <textarea
                id={`${id}-note`}
                rows={2}
                value={details.context_note}
                onChange={(e) => set({ context_note: e.target.value })}
                placeholder="For example, labs from the spring follow-up visit"
                className={`${FIELD} py-2`}
              />
            </div>
          </div>
        </div>
      </div>

      {samples && samples.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Try a sample document</p>
            <p className="mt-0.5 text-sm text-muted">
              Fictional files with updates already read out, so no API key is needed.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {samples.map((sample) => (
              <button
                key={sample.id}
                type="button"
                disabled={uploading}
                onClick={() => onSample(sample)}
                className={`${BUTTON} border border-line bg-surface text-ink hover:bg-secondary`}
              >
                <FileText size={16} aria-hidden />
                {SAMPLE_LABELS[sample.id]}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
