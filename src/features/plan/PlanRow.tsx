// ABOUTME: One plan item on the timeline: a date badge, the title (a link to the visit page), how
// ABOUTME: far away it is, a status chip, an excerpt of the notes, a Prepare link, and editing in place.
import { Link } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { InlineEdit } from "@/components/InlineEdit";
import { StatusChip } from "@/components/StatusChip";
import type { PlanItem } from "@/hooks/usePlanItems";
import { formatRelative } from "@/lib/format";
import { dateBadge, planChip } from "@/lib/plan";
import { PLAN_ITEM_FIELDS } from "./planFields";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function DateBadge({ date, muted }: { date: string | null; muted: boolean }) {
  const parts = date ? dateBadge(date) : null;
  return (
    <div
      aria-hidden
      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-paper ${
        muted ? "text-muted" : "text-ink"
      }`}
    >
      {parts ? (
        <>
          <span className="text-[11px] font-medium uppercase leading-none tracking-wider text-muted">
            {parts.month}
          </span>
          <span className="mt-0.5 font-display text-2xl leading-none tabular-nums">
            {parts.day}
          </span>
        </>
      ) : (
        <CalendarClock size={20} />
      )}
    </div>
  );
}

export function PlanRow({
  item,
  overdue,
  canPrep,
  onSave,
  onDelete,
}: {
  item: PlanItem;
  overdue: boolean;
  /** Show the Prepare shortcut (open items, when the AI brief is available). */
  canPrep: boolean;
  /** Saves an edited item; `prev` is what it replaces, for Undo. */
  onSave: (next: PlanItem, prev: PlanItem) => Promise<void>;
  onDelete: (item: PlanItem) => Promise<void>;
}) {
  return (
    <li data-plan-row={item.id} className="border-t border-line first:border-t-0">
      <InlineEdit
        value={item}
        fields={PLAN_ITEM_FIELDS}
        subject={item.title}
        onSave={onSave}
        onDelete={() => onDelete(item)}
        className="px-1 py-4"
      >
        {(shown, pencil) => (
          <PlanRowView item={shown} overdue={overdue} canPrep={canPrep} pencil={pencil} />
        )}
      </InlineEdit>
    </li>
  );
}

function PlanRowView({
  item,
  overdue,
  canPrep,
  pencil,
}: {
  item: PlanItem;
  overdue: boolean;
  canPrep: boolean;
  pencil: React.ReactNode;
}) {
  const done = item.status === "Completed";
  const chip = planChip(item, overdue);
  return (
    <div className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]">
      <DateBadge date={item.event_date} muted={done} />
      <div className="min-w-0">
        <Link
          to="/plan/$visitId"
          params={{ visitId: item.id }}
          className={`font-medium after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring ${
            done ? "text-muted" : "text-ink"
          }`}
        >
          {item.title}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <StatusChip level={chip.level} label={chip.label} />
          {item.event_date && (
            <span className="text-xs text-muted tabular-nums">
              {capitalize(formatRelative(item.event_date))}
            </span>
          )}
        </div>
        {item.body && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{item.body}</p>
        )}
      </div>
      <div className="relative z-10 col-start-2 flex items-center gap-2 sm:col-start-3 sm:row-start-1 sm:self-start">
        {canPrep && (
          <Link
            to="/plan/$visitId"
            params={{ visitId: item.id }}
            aria-label={`Prepare for ${item.title}`}
            className="inline-flex h-9 items-center rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Prepare
          </Link>
        )}
        {pencil}
      </div>
    </div>
  );
}
