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
      className="group flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h2 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">{label}</h2>
        {badge}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="font-display text-5xl leading-none whitespace-nowrap text-ink tabular-nums">
          {value}
          {unit && <span className="ml-1.5 font-sans text-sm text-muted">{unit}</span>}
        </p>
        {aside}
      </div>
      {footer && <div className="mt-auto pt-4 text-sm leading-snug text-muted">{footer}</div>}
    </Link>
  );
}
