// ABOUTME: Placeholder /plan/$visitId page until Task 6: the plan item's date, status and notes,
// ABOUTME: or a not-found state when no plan item has that id.
import { MascotLoader } from "@/components/MascotLoader";
import { NotFoundState } from "@/components/shell/NotFoundState";
import { Page } from "@/components/shell/Page";
import { usePlanItems } from "@/hooks/usePlanItems";
import { formatDate } from "@/lib/format";

export function VisitPage({ visitId }: { visitId: string }) {
  const { items, loading } = usePlanItems();
  const item = items.find((i) => i.id === visitId);

  if (loading) return <MascotLoader label="Loading visit…" />;
  if (!item) {
    return (
      <NotFoundState
        title="Visit not found"
        body="That plan item doesn't exist. It may have been deleted."
        backTo="/plan"
        backLabel="Back to Plan"
      />
    );
  }

  const meta = [item.event_date ? formatDate(item.event_date, "long") : null, item.status]
    .filter(Boolean)
    .join(" · ");

  return (
    <Page
      title={item.title}
      description={meta}
      breadcrumbs={[{ label: "Plan", to: "/plan" }, { label: item.title }]}
    >
      {item.body && (
        <p className="whitespace-pre-wrap rounded-[20px] border border-line bg-surface p-5 text-sm leading-relaxed text-ink">
          {item.body}
        </p>
      )}
    </Page>
  );
}
