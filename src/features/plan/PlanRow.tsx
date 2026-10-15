// ABOUTME: One plan item on the timeline: a date badge, the title (a link to the visit page), how
// ABOUTME: far away it is, a status chip, an excerpt of the notes, plus Prepare and Edit actions.
import { Link } from "@tanstack/react-router";
import { CalendarClock, Pencil } from "lucide-react";
import { StatusChip } from "@/components/StatusChip";
import type { PlanItem } from "@/hooks/usePlanItems";
import { formatRelative } from "@/lib/format";
import { dateBadge, planChip } from "@/lib/plan";

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
  onEdit,
}: {
  item: PlanItem;
  overdue: boolean;
  /** Show the Prepare shortcut (open items, when the AI brief is available). */
  canPrep: boolean;
  onEdit: (item: PlanItem) => void;
}) {
  const done = item.status === "Completed";
  const chip = planChip(item, overdue);
  return (
    <li
      data-plan-row={item.id}
      className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 border-t border-line px-1 py-4 first:border-t-0 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]"
    >
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
        <button
          type="button"
          onClick={() => onEdit(item)}
          aria-label={`Edit ${item.title}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors duration-200 ease-out hover:bg-secondary hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Pencil size={15} aria-hidden />
        </button>
      </div>
    </li>
  );
}
