// ABOUTME: The /documents/$docId page: the document's details, a preview of the text read from it,
// ABOUTME: and what came from it (lab results linked to their pages), or not-found for an unknown id.
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MascotLoader } from "@/components/MascotLoader";
import { NotFoundState } from "@/components/shell/NotFoundState";
import { Page } from "@/components/shell/Page";
import { StatusChip } from "@/components/StatusChip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteDocument, useDocuments } from "@/hooks/useDocuments";
import { useLabResults, type LabResult } from "@/hooks/useLabResults";
import { SAVE_TOAST_ID } from "@/hooks/useUndoableSave";
import { useAppSession } from "@/lib/appSession";
import { documentKind, documentStatus, formatFileSize } from "@/lib/documents";
import { formatDate, formatNumber } from "@/lib/format";
import { PSA_METRIC_SLUG, formatLabValue, labStatus, metricSlug } from "@/lib/labs";

/** Where a lab result lives: PSA has its own page, every other metric its metric page. */
function labHref(metric: string): string {
  const slug = metricSlug(metric);
  return slug === PSA_METRIC_SLUG ? "/labs/psa" : `/labs/${slug}`;
}

function ExtractedItem({ lab }: { lab: LabResult }) {
  const value = lab.value_numeric ?? lab.value_text;
  const status = labStatus({
    metric: lab.metric,
    value,
    flag: lab.flag ?? undefined,
    reference_range: lab.reference_range ?? undefined,
  });
  return (
    <li>
      <Link
        to={labHref(lab.metric)}
        className="group flex items-center gap-3 px-4 py-3 transition-colors duration-200 ease-out hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink">{lab.metric}</span>
          <span className="block text-xs text-muted tabular-nums">
            {[lab.category, lab.date ? formatDate(lab.date) : "No date"]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className="text-sm whitespace-nowrap text-ink tabular-nums">
          {formatLabValue(value)}
          {lab.unit && <span className="ml-1 text-xs text-muted">{lab.unit}</span>}
        </span>
        <StatusChip level={status.level} label={status.label} />
        <ChevronRight
          size={16}
          aria-hidden
          className="shrink-0 text-muted transition-transform duration-200 ease-out group-hover:translate-x-0.5"
        />
      </Link>
    </li>
  );
}

export function DocumentPage({ docId }: { docId: string }) {
  const { password } = useAppSession();
  const navigate = useNavigate();
  const { documents, loading } = useDocuments();
  const { items: labs, loading: labsLoading } = useLabResults();
  const [showAll, setShowAll] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const doc = documents.find((d) => d.id === docId);

  // useDocuments starts with an empty list, so wait for the first load before deciding.
  if (loading && !doc) return <MascotLoader label="Loading document…" />;
  if (!doc) {
    return (
      <NotFoundState
        title="Document not found"
        body="That document doesn't exist. It may have been deleted."
        backTo="/documents"
        backLabel="Back to Documents"
      />
    );
  }

  const kind = documentKind(doc);
  const status = documentStatus(doc.status);
  // In the order they were added, which follows the document.
  const fromDoc = labs
    .filter((l) => l.source_document_id === doc.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const text = doc.extracted_text?.trim() ?? "";
  const long = text.length > 600 || text.split("\n").length > 12;

  async function remove() {
    try {
      await deleteDocument(password, docId);
      toast.success(`Deleted ${doc!.name}`, { id: SAVE_TOAST_ID });
      void navigate({ to: "/documents" });
    } catch (e) {
      toast.error("Could not delete", {
        id: SAVE_TOAST_ID,
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const meta: { label: string; value: React.ReactNode }[] = [
    { label: "Type", value: kind.label },
    { label: "Added", value: formatDate(doc.uploaded_at, "long") },
    { label: "Size", value: formatFileSize(doc.size_bytes) },
    { label: "Status", value: <StatusChip level={status.level} label={status.label} /> },
    {
      label: "Text read",
      value:
        doc.extracted_chars > 0 ? `${formatNumber(doc.extracted_chars)} characters` : "None yet",
    },
  ];

  return (
    <Page
      title={doc.name}
      breadcrumbs={[{ label: "Documents", to: "/documents" }, { label: doc.name }]}
      wide
      actions={
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Trash2 size={14} aria-hidden />
          Delete
        </button>
      }
    >
      <div className="space-y-6">
        <section
          aria-label="Details"
          className="rounded-[20px] border border-line bg-surface p-5 sm:p-6"
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
            {meta.map((m) => (
              <div key={m.label} className="min-w-0">
                <dt className="text-xs font-medium tracking-wider text-muted uppercase">
                  {m.label}
                </dt>
                <dd className="mt-1.5 text-sm text-ink tabular-nums">{m.value}</dd>
              </div>
            ))}
          </dl>
          {doc.error && (
            <p className="mt-5 border-t border-line pt-5 text-sm text-ink">
              <StatusChip level="act" label="Could not read" />{" "}
              <span className="ml-1">{doc.error}</span>
            </p>
          )}
        </section>

        <section
          aria-labelledby="text-heading"
          className="rounded-[20px] border border-line bg-surface p-5 sm:p-6"
        >
          <h2 id="text-heading" className="font-display text-2xl text-ink">
            Text read from it
          </h2>
          {text ? (
            <>
              <div className="mt-4 rounded-xl border border-line bg-paper p-4">
                <pre
                  id="document-text"
                  className={`font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-ink ${
                    long && !showAll ? "line-clamp-[12]" : ""
                  }`}
                >
                  {text}
                </pre>
              </div>
              {long && (
                <button
                  type="button"
                  aria-expanded={showAll}
                  aria-controls="document-text"
                  onClick={() => setShowAll((s) => !s)}
                  className="mt-3 inline-flex h-9 items-center rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {showAll ? "Show less" : "Show all"}
                </button>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {doc.extracted_chars > 0
                ? "The text was indexed for the Assistant, but no preview is kept for this document."
                : "No text could be read from this file."}
            </p>
          )}
        </section>
        <section
          aria-labelledby="from-doc-heading"
          className="overflow-hidden rounded-[20px] border border-line bg-surface"
        >
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <h2 id="from-doc-heading" className="font-display text-2xl text-ink">
              What came from this document
            </h2>
            {fromDoc.length > 0 && (
              <p className="mt-0.5 text-sm text-muted">
                {fromDoc.length} {fromDoc.length === 1 ? "result was" : "results were"} added to
                Labs from it.
              </p>
            )}
          </div>
          {labsLoading ? (
            <p className="px-5 py-6 text-sm text-muted">Loading…</p>
          ) : fromDoc.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">
              Nothing in the record points back to this document yet. Lab results you apply from an
              upload are listed here.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {fromDoc.map((lab) => (
                <ExtractedItem key={lab.id} lab={lab} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="rounded-[20px] border-line bg-surface sm:rounded-[20px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal text-ink">
              Delete {doc.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              The Assistant will no longer read it. Results already added to Labs stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Keep it</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={() => void remove()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
