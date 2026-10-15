// ABOUTME: One metric in the labs list: name and reference range, the latest value with a flag chip,
// ABOUTME: a sparkline and the draw date. The row opens the metric page; "Ask about this" opens the assistant.
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { openAssistant } from "@/components/assistant/assistantStore";
import { Sparkline } from "@/components/charts/Sparkline";
import { StatusChip } from "@/components/StatusChip";
import { formatDate } from "@/lib/format";
import { FLAG_LABELS, formatLabValue, type LabMetric } from "@/lib/labs";

/** PSA has its own deep dive, built from the PSA readings rather than the lab rows. */
const PSA_SLUG = "psa-total";

export function LabRow({ metric }: { metric: LabMetric }) {
  const { latest, flag, name } = metric;
  const value = formatLabValue(latest.value);
  const unit = latest.unit?.trim();
  const to = metric.slug === PSA_SLUG ? "/labs/psa" : `/labs/${metric.slug}`;

  return (
    <li
      data-lab-row={metric.slug}
      data-flag={flag}
      className="flex items-center gap-2 px-4 py-3 transition-colors duration-200 ease-out hover:bg-secondary/60 sm:gap-3 sm:px-5"
    >
      <Link
        to={to}
        className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_5.5rem_6.5rem]"
      >
        <span className="min-w-0">
          <span className="block font-medium text-ink">{name}</span>
          {latest.reference_range && (
            <span className="block text-xs text-muted tabular-nums">
              Ref {latest.reference_range}
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 md:justify-start">
          <span className="font-display text-2xl leading-none whitespace-nowrap text-ink tabular-nums">
            {value}
            {unit && (
              <>
                {" "}
                <span className="ml-0.5 font-sans text-xs text-muted">{unit}</span>
              </>
            )}
          </span>
          {flag && <StatusChip level="watch" label={FLAG_LABELS[flag]} />}
        </span>

        <span className="hidden h-9 items-center justify-center md:flex">
          <Sparkline
            values={metric.series.map((p) => p.value)}
            status={flag ? "watch" : undefined}
            width={72}
          />
        </span>

        <span className="col-span-2 text-xs text-muted tabular-nums md:col-span-1 md:text-right">
          {latest.date ? formatDate(latest.date) : "No date"}
        </span>
      </Link>

      <button
        type="button"
        onClick={() =>
          openAssistant({
            label: `${name} result`,
            prompt: `What does my latest ${name} result of ${value}${unit ? ` ${unit}` : ""} mean?`,
          })
        }
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-xs font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-3"
      >
        <Sparkles size={14} aria-hidden />
        <span className="sr-only sm:not-sr-only">Ask about this</span>
        <span className="sr-only">{name}</span>
      </button>
    </li>
  );
}
