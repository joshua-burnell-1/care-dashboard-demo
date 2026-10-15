// ABOUTME: Today's change feed: up to five new results, documents and edits since the last plan
// ABOUTME: item, each linking to where it lives, and a link to the full activity log.
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronRight,
  FileText,
  FlaskConical,
  PencilLine,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ChangeItem } from "@/lib/changes";
import { formatDate, formatRelative } from "@/lib/format";

const ICONS: Record<ChangeItem["kind"], LucideIcon> = {
  psa: TrendingUp,
  lab: FlaskConical,
  document: FileText,
  edit: PencilLine,
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function WhatChanged({
  items,
  since,
  sinceLabel,
}: {
  items: ChangeItem[];
  since: string;
  sinceLabel: string | null;
}) {
  const shown = items.slice(0, 5);
  return (
    <section
      aria-labelledby="what-changed-heading"
      className="flex flex-col rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="what-changed-heading" className="font-display text-3xl text-ink">
          What changed
        </h2>
        <Link
          to="/activity"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted transition-colors duration-200 ease-out hover:text-ink"
        >
          See all activity <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        Since {formatDate(since)}
        {sinceLabel ? `: ${sinceLabel}` : ""}
      </p>
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nothing new since then.</p>
      ) : (
        <ul className="mt-3 -mx-2">
          {shown.map((item) => {
            const Icon = ICONS[item.kind];
            return (
              <li key={item.id}>
                <Link
                  to={item.to}
                  data-change-kind={item.kind}
                  className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-ink">
                    <Icon size={16} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {item.title}
                    </span>
                    {item.detail && (
                      <span className="block truncate text-xs text-muted">{item.detail}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {capitalize(formatRelative(item.date))}
                  </span>
                  <ChevronRight
                    size={16}
                    aria-hidden
                    className="shrink-0 text-muted transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
