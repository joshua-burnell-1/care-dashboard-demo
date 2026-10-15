// ABOUTME: The plan timeline: overdue, upcoming, ongoing and past items as grouped lists of rows,
// ABOUTME: with an empty state that points at the Add button.
import type { PlanItem } from "@/hooks/usePlanItems";
import { demoDb } from "@/integrations/supabase/client";
import { canPrepare, type TimelineBuckets } from "@/lib/plan";
import { PlanRow } from "./PlanRow";

function Group({
  label,
  items,
  overdue = false,
  prepFrom,
  onEdit,
}: {
  label: string;
  items: PlanItem[];
  overdue?: boolean;
  /** Today's date: items from then on get a Prepare link. Omit for none. */
  prepFrom?: string;
  onEdit: (item: PlanItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label={label} data-timeline-group={label}>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
        {label} <span className="tabular-nums">· {items.length}</span>
      </h3>
      <ol className="rounded-[20px] border border-line bg-surface px-4 sm:px-5">
        {items.map((it) => (
          <PlanRow
            key={it.id}
            item={it}
            overdue={overdue}
            canPrep={!!prepFrom && canPrepare(it, prepFrom)}
            onEdit={onEdit}
          />
        ))}
      </ol>
    </section>
  );
}

export function Timeline({
  buckets,
  today,
  onEdit,
}: {
  buckets: TimelineBuckets;
  today: string;
  onEdit: (item: PlanItem | null) => void;
}) {
  const { overdue, upcoming, ongoing, past } = buckets;
  const total = overdue.length + upcoming.length + ongoing.length + past.length;
  if (total === 0) {
    return (
      <p className="rounded-[20px] border border-line bg-surface p-5 text-sm text-muted">
        No plan items yet. Use Add plan item to create the first one.
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {upcoming.length === 0 && overdue.length === 0 && (
        <p className="text-sm text-muted">Nothing is coming up.</p>
      )}
      <Group label="Overdue" items={overdue} overdue onEdit={onEdit} />
      <Group
        label="Upcoming"
        items={upcoming}
        prepFrom={demoDb ? today : undefined}
        onEdit={onEdit}
      />
      <Group label="Ongoing and on hold" items={ongoing} onEdit={onEdit} />
      <Group label="Past" items={past} onEdit={onEdit} />
    </div>
  );
}
