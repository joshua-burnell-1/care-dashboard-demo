// ABOUTME: The next three plan items on Today, each with its date, how far away it is and a
// ABOUTME: Prepare button that opens the visit page. The soonest gets the one coral call to action.
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { PlanItem } from "@/hooks/usePlanItems";
import { formatDate, formatRelative } from "@/lib/format";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function UpNext({ items }: { items: PlanItem[] }) {
  return (
    <section
      aria-labelledby="up-next-heading"
      className="flex flex-col rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="up-next-heading" className="font-display text-3xl text-ink">
          Up next
        </h2>
        <Link
          to="/plan"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors duration-200 ease-out hover:text-ink"
        >
          Full plan <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Nothing is scheduled. Add a visit on the Plan page.
        </p>
      ) : (
        <ol className="mt-2">
          {items.map((item, i) => (
            <li
              key={item.id}
              data-up-next-item
              className="flex flex-col gap-3 border-t border-line py-4 first:border-t-0 sm:flex-row sm:items-center sm:gap-5"
            >
              <div className="w-28 shrink-0">
                <p className="text-sm font-semibold text-ink tabular-nums">
                  {capitalize(formatRelative(item.event_date!))}
                </p>
                <p className="text-xs text-muted tabular-nums">{formatDate(item.event_date!)}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{item.title}</p>
                {item.body && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted lg:line-clamp-1">
                    {item.body}
                  </p>
                )}
              </div>
              <Link
                to="/plan/$visitId"
                params={{ visitId: item.id }}
                aria-label={`Prepare for ${item.title}`}
                className={`inline-flex h-9 shrink-0 items-center justify-center self-start rounded-xl px-4 text-sm font-medium transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:self-center ${
                  i === 0
                    ? "bg-accent text-accent-foreground hover:bg-accent/90"
                    : "border border-line bg-surface text-ink hover:bg-secondary"
                }`}
              >
                Prepare
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
