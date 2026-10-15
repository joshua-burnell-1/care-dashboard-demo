// ABOUTME: One headline number on Today: a label, the value in large display numerals with its
// ABOUTME: unit, an optional status chip and a footer line. The whole tile links to its detail page.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function KpiTile({
  label,
  value,
  unit,
  badge,
  footer,
  aside,
  to,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  /** A status chip beside the label. */
  badge?: ReactNode;
  footer?: ReactNode;
  /** Something small beside the value, such as a sparkline. */
  aside?: ReactNode;
  to: string;
}) {
  return (
    <Link
      to={to}
      data-kpi={label}
      className="group flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-4 transition sm:p-5 duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h2 className="text-[11px] font-medium tracking-[0.1em] text-muted uppercase sm:text-xs sm:tracking-[0.12em]">
          {label}
        </h2>
        {badge}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <p className="font-display text-[2rem] leading-none whitespace-nowrap text-ink tabular-nums sm:text-5xl">
          {value}
          {unit && <span className="ml-1.5 font-sans text-sm text-muted">{unit}</span>}
        </p>
        {aside}
      </div>
      {footer && (
        <div className="mt-auto pt-3 text-xs leading-snug text-muted sm:pt-4 sm:text-sm">
          {footer}
        </div>
      )}
    </Link>
  );
}
