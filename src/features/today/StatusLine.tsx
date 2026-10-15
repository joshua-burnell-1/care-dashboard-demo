// ABOUTME: The top of Today: who this is about, a status chip in words, the one-sentence answer to
// ABOUTME: "how is he doing" as the page heading, the next step, and the page actions.
import type { ReactNode } from "react";
import { StatusChip } from "@/components/StatusChip";
import { formatDate } from "@/lib/format";
import { STATUS_LABELS, type Status } from "@/lib/status";

export function StatusLine({
  status,
  eyebrow,
  asOf,
  actions,
}: {
  status: Status;
  /** Who and what this is about, e.g. the patient's name and diagnosis. */
  eyebrow?: string;
  /** Date of the latest result the status is based on. */
  asOf?: string | null;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
      <div className="min-w-0 max-w-4xl">
        {eyebrow && (
          <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">{eyebrow}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusChip level={status.level} label={STATUS_LABELS[status.level]} size="md" />
          {asOf && (
            <span className="text-sm text-muted">Based on the result from {formatDate(asOf)}</span>
          )}
        </div>
        <h1 className="mt-4 font-display text-[2.5rem] leading-[1.05] tracking-tight text-balance text-ink tabular-nums sm:text-5xl lg:text-6xl">
          {status.lead}
        </h1>
        {status.nextStep && (
          <p className="mt-4 text-base text-pretty text-muted sm:text-lg">{status.nextStep}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
