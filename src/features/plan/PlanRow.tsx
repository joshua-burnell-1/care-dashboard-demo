// ABOUTME: One plan item on the timeline: date, title, status pill and body, clickable to edit,
// ABOUTME: with an optional "Prepare for this visit" button in demo mode.
import { Pencil, Sparkles } from "lucide-react";
import type { PlanItem } from "@/hooks/usePlanItems";
import { demoDb } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { pillClasses } from "@/features/shared/sections";

function pillToneFor(status: string): string {
  switch (status) {
    case "Locked":
    case "Scheduled":
      return "info";
    case "In flight":
      return "warn";
    case "Daily":
    case "Completed":
      return "ok";
    default:
      return "neutral";
  }
}

export function PlanRow({
  item,
  overdue,
  showDate,
  canPrep = false,
  onEdit,
  onPrep,
}: {
  item: PlanItem;
  overdue: boolean;
  showDate: boolean;
  canPrep?: boolean;
  onEdit: (item: PlanItem) => void;
  onPrep: (item: PlanItem) => void;
}) {
  const done = item.status === "Completed";
  const displayStatus = overdue ? "Overdue" : item.status;
  const displayTone = overdue ? "rose" : pillToneFor(item.status);
  return (
    <li className="relative pl-5">
      <span
        className={`absolute -left-[7px] top-3 w-3 h-3 rounded-full border-2 border-white ${
          done ? "bg-emerald-400" : overdue ? "bg-rose-400" : "bg-stone-300"
        }`}
      />
      <button
        type="button"
        onClick={() => onEdit(item)}
        className={`w-full text-left -mx-2 px-2 py-1.5 rounded-lg hover:bg-stone-50/80 transition cursor-pointer ${done ? "opacity-60" : ""}`}
        aria-label={`Edit ${item.title}`}
      >
        <div className="flex flex-wrap items-baseline gap-2">
          {showDate && item.event_date && (
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider tabular-nums ${overdue ? "text-rose-600" : "text-stone-500"}`}
            >
              {formatDate(item.event_date)}
            </span>
          )}
          <p
            className={`font-semibold text-sm ${done ? "line-through text-stone-400" : "text-stone-900"}`}
          >
            {item.title}
          </p>
          {displayStatus && (
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${pillClasses[displayTone] ?? pillClasses.neutral}`}
            >
              {displayStatus}
            </span>
          )}
          <span
            aria-hidden
            className="ml-auto inline-flex items-center justify-center h-7 w-7 -my-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition"
          >
            <Pencil size={14} />
          </span>
        </div>
        {item.body && (
          <p
            className={`text-sm mt-1.5 leading-relaxed whitespace-pre-wrap ${done ? "text-stone-400" : "text-stone-600"}`}
          >
            {item.body}
          </p>
        )}
      </button>
      {canPrep && demoDb && (
        <button
          type="button"
          onClick={() => onPrep(item)}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
        >
          <Sparkles size={12} aria-hidden="true" />
          Prepare for this visit
        </button>
      )}
    </li>
  );
}
