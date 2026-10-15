// ABOUTME: Placeholder /documents/$docId page until Task 8: the document's name, type, size and
// ABOUTME: upload date, or a not-found state when no document has that id.
import { MascotLoader } from "@/components/MascotLoader";
import { NotFoundState } from "@/components/shell/NotFoundState";
import { Page } from "@/components/shell/Page";
import { useDocuments } from "@/hooks/useDocuments";
import { formatDate, formatNumber } from "@/lib/format";

export function DocumentPage({ docId }: { docId: string }) {
  const { documents, loading } = useDocuments();
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

  const meta = [
    `Uploaded ${formatDate(doc.uploaded_at)}`,
    `${formatNumber(Math.max(1, Math.round(doc.size_bytes / 1024)))} KB`,
    doc.status,
  ].join(" · ");

  return (
    <Page
      title={doc.name}
      description={meta}
      breadcrumbs={[{ label: "Documents", to: "/documents" }, { label: doc.name }]}
    >
      {doc.error && (
        <p className="rounded-[20px] border border-line bg-surface p-5 text-sm text-ink">
          {doc.error}
        </p>
      )}
    </Page>
  );
}
