// ABOUTME: The /documents page: the upload card first, then the library (name, kind, date, status,
// ABOUTME: items added) with search, a kind filter and pages kept in the URL, and the review step.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, FileText, Search, X } from "lucide-react";
import { MascotLoader } from "@/components/MascotLoader";
import { Pagination } from "@/components/Pagination";
import { Page } from "@/components/shell/Page";
import { StatusChip } from "@/components/StatusChip";
import { SuggestionsModal } from "@/components/dashboard/SuggestionsModal";
import { isDemoMode } from "@/demo/isDemoMode";
import { SAMPLE_DOCUMENTS } from "@/demo/samples";
import { useDocuments, type Document } from "@/hooks/useDocuments";
import { useLabResults } from "@/hooks/useLabResults";
import { usePsaReadings } from "@/hooks/usePsaReadings";
import { useAppSession } from "@/lib/appSession";
import { DOCUMENT_KINDS, documentKind, documentStatus, filterDocuments } from "@/lib/documents";
import { formatDate } from "@/lib/format";
import { paginate } from "@/lib/labs";
import { UploadZone } from "./UploadZone";
import { useDocumentUpload, type PendingSuggestions } from "./useDocumentUpload";

const PAGE_SIZE = 10;

const control =
  "h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** What came from a document, or "Reference" for one kept only to read. */
function itemsLabel(n: number) {
  return n === 0 ? "Reference" : `${n} ${n === 1 ? "item" : "items"}`;
}

function DocumentRow({ doc, items }: { doc: Document; items: number }) {
  const kind = documentKind(doc);
  const status = documentStatus(doc.status);
  return (
    <li data-document-row={doc.name}>
      <Link
        to="/documents/$docId"
        params={{ docId: doc.id }}
        className="group grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3.5 transition-colors duration-200 ease-out hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset sm:px-5 md:grid-cols-[2.25rem_minmax(0,1fr)_6.5rem_7.5rem_6.5rem_5.5rem_1rem]"
      >
        <span
          aria-hidden
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line text-ink"
        >
          <FileText size={16} />
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 font-medium break-words text-ink md:line-clamp-1">
            {doc.name}
          </span>
          <span className="block text-xs text-muted tabular-nums md:hidden">
            {[kind.label, formatDate(doc.uploaded_at), itemsLabel(items)].join(" · ")}
          </span>
        </span>
        <span className="hidden text-sm text-muted md:block">{kind.label}</span>
        <span className="hidden text-sm text-muted tabular-nums md:block">
          {formatDate(doc.uploaded_at)}
        </span>
        <span className="justify-self-end md:justify-self-start">
          <StatusChip level={status.level} label={status.label} />
        </span>
        <span className="hidden text-sm text-muted tabular-nums md:block">{itemsLabel(items)}</span>
        <ChevronRight
          size={16}
          aria-hidden
          className="hidden text-muted transition-transform duration-200 ease-out group-hover:translate-x-0.5 md:block"
        />
      </Link>
    </li>
  );
}

function Empty({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-dashed border-line px-5 py-12 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-muted">
        <FileText size={22} aria-hidden />
      </span>
      <p className="mt-4 font-display text-2xl text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
      {children}
    </div>
  );
}

export function DocumentsPage() {
  const { password } = useAppSession();
  const search = useSearch({ from: "/documents/" });
  const navigate = useNavigate({ from: "/documents/" });
  const { documents, loading, refresh } = useDocuments();
  const { items: labs } = useLabResults();
  const { items: psaReadings } = usePsaReadings();
  const [review, setReview] = useState<PendingSuggestions | null>(null);

  const { uploading, healthIssues, uploadFiles, trySample } = useDocumentUpload({
    password,
    onUploaded: refresh,
    onSuggestions: setReview,
  });

  const q = search.q ?? "";
  const kind = search.type ?? "";

  // A type the page does not know is dropped from the URL, replacing the history entry.
  const knownKind = !kind || DOCUMENT_KINDS.some((k) => k.value === kind);
  useEffect(() => {
    if (!knownKind) {
      void navigate({
        search: (prev) => ({ ...prev, type: undefined, page: undefined }),
        replace: true,
        resetScroll: false,
      });
    }
  }, [knownKind, navigate]);

  // The box holds what was typed; the URL follows it, and follows back and forward too.
  const [typed, setTyped] = useState(q);
  const lastWritten = useRef(q);
  useEffect(() => {
    if (q !== lastWritten.current) {
      lastWritten.current = q;
      setTyped(q);
    }
  }, [q]);

  /** Any filter change goes back to page 1; typing replaces the history entry. */
  function setFilters(next: { q?: string; type?: string }) {
    const merged = { q, type: kind, ...next };
    void navigate({
      search: {
        q: merged.q.trim() ? merged.q : undefined,
        type: merged.type || undefined,
        page: undefined,
      },
      replace: next.q !== undefined,
      resetScroll: false,
    });
  }

  function clearFilters() {
    lastWritten.current = "";
    setTyped("");
    void navigate({ search: {}, resetScroll: false });
  }

  const itemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of [...labs, ...psaReadings]) {
      if (row.source_document_id) {
        counts.set(row.source_document_id, (counts.get(row.source_document_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [labs, psaReadings]);

  const filtered = useMemo(() => filterDocuments(documents, { q, kind }), [documents, q, kind]);
  const paged = useMemo(() => paginate(filtered, search.page ?? 1, PAGE_SIZE), [filtered, search]);

  // A page past the end (or below 1) was clamped for display; make the URL say so.
  const requestedPage = search.page;
  useEffect(() => {
    if (loading || requestedPage === undefined || requestedPage === paged.page) return;
    void navigate({
      search: (prev) => ({ ...prev, page: paged.page === 1 ? undefined : paged.page }),
      replace: true,
      resetScroll: false,
    });
  }, [loading, requestedPage, paged.page, navigate]);

  // Only kinds in the library are offered, plus whatever the URL already asks for.
  const kinds = useMemo(() => {
    const present = new Set(documents.map((d) => documentKind(d).value));
    return DOCUMENT_KINDS.filter((k) => present.has(k.value) || k.value === kind);
  }, [documents, kind]);
  const filtering = Boolean(q.trim() || kind);
  const count = documents.length;

  return (
    <Page
      title="Documents"
      description={
        loading ? undefined : `${count} ${count === 1 ? "document" : "documents"} in the record`
      }
      wide
    >
      {review && (
        <SuggestionsModal
          open
          filename={review.filename}
          documentId={review.documentId}
          suggestions={review.updates}
          password={password}
          onClose={() => setReview(null)}
          onApplied={() => {
            setReview(null);
            void navigate({ to: "/documents/$docId", params: { docId: review.documentId } });
          }}
        />
      )}

      <div className="space-y-8">
        {healthIssues.length > 0 && (
          <div className="flex items-start gap-3 rounded-[20px] border border-line bg-surface p-5">
            <StatusChip level="watch" label="Setup" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-ink">Uploads may fail until this is set up:</p>
              <ul className="mt-1 list-inside list-disc text-muted">
                {healthIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <UploadZone
          uploading={uploading}
          onFiles={uploadFiles}
          samples={isDemoMode(import.meta.env) ? SAMPLE_DOCUMENTS : undefined}
          onSample={(sample) => void trySample(sample)}
        />

        <section aria-labelledby="library-heading" className="space-y-4">
          <h2 id="library-heading" className="font-display text-3xl text-ink">
            Library
          </h2>
          {loading ? (
            <MascotLoader label="Loading documents…" />
          ) : count === 0 ? (
            <Empty
              title="No documents yet"
              body="Add a lab report, visit note or scan above. Its text is read so the Assistant can use it, and any new results are offered for review."
            />
          ) : (
            <>
              <form
                role="search"
                aria-label="Filter documents"
                onSubmit={(e) => e.preventDefault()}
                className="flex flex-wrap items-center gap-2 sm:gap-3"
              >
                <div className="relative min-w-0 basis-full sm:basis-64 sm:flex-1">
                  <Search
                    size={16}
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="search"
                    aria-label="Search documents"
                    placeholder="Search by name"
                    value={typed}
                    onChange={(e) => {
                      setTyped(e.target.value);
                      lastWritten.current = e.target.value.trim() ? e.target.value : "";
                      setFilters({ q: e.target.value });
                    }}
                    className={`${control} w-full pl-9 placeholder:text-muted`}
                  />
                </div>
                <div className="relative min-w-0 basis-full sm:basis-auto sm:flex-none">
                  <select
                    aria-label="Type"
                    value={kind}
                    onChange={(e) => setFilters({ type: e.target.value })}
                    className={`${control} w-full appearance-none pr-9 sm:w-48`}
                  >
                    <option value="">All types</option>
                    {kinds.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
                  />
                </div>
              </form>

              <p role="status" className="text-sm text-muted tabular-nums">
                {filtered.length === 0
                  ? "No documents"
                  : `Showing ${(paged.page - 1) * PAGE_SIZE + 1} to ${Math.min(paged.page * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
                {filtering && filtered.length > 0 && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1 rounded-md text-ink underline underline-offset-2"
                    >
                      <X size={12} aria-hidden />
                      Clear filters
                    </button>
                  </>
                )}
              </p>

              {filtered.length === 0 ? (
                <Empty
                  title="No documents match"
                  body="Try a different name or type, or show the whole library."
                >
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-5 inline-flex h-10 items-center rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    Clear filters
                  </button>
                </Empty>
              ) : (
                <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
                  <div
                    aria-hidden
                    className="hidden grid-cols-[2.25rem_minmax(0,1fr)_6.5rem_7.5rem_6.5rem_5.5rem_1rem] gap-x-3 border-b border-line px-5 py-3 text-xs font-medium tracking-wider text-muted uppercase md:grid"
                  >
                    <span />
                    <span>Name</span>
                    <span>Type</span>
                    <span>Added</span>
                    <span>Status</span>
                    <span>From it</span>
                    <span />
                  </div>
                  <ul className="divide-y divide-line">
                    {paged.items.map((doc) => (
                      <DocumentRow key={doc.id} doc={doc} items={itemCounts.get(doc.id) ?? 0} />
                    ))}
                  </ul>
                </div>
              )}

              <Pagination
                page={paged.page}
                pages={paged.pages}
                onPageChange={(page) =>
                  void navigate({
                    search: (prev) => ({ ...prev, page: page === 1 ? undefined : page }),
                  })
                }
              />
            </>
          )}
        </section>
      </div>
    </Page>
  );
}
