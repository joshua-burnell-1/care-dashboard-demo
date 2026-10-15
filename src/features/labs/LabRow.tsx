// ABOUTME: One metric in the labs list: name and reference range, the latest value with a flag chip,
// ABOUTME: its trend and the draw date. The row opens the metric page; a quiet icon asks the assistant.
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from "lucide-react";
import { openAssistant } from "@/components/assistant/assistantStore";
import { Sparkline } from "@/components/charts/Sparkline";
import { StatusChip } from "@/components/StatusChip";
import { formatDate } from "@/lib/format";
import {
  FLAG_LABELS,
  PSA_METRIC_SLUG,
  formatLabValue,
  trendFor,
  type LabMetric,
  type Trend,
} from "@/lib/labs";

const DELTA_ICONS = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };

/** The trend cell: a sparkline for three or more readings, the change for two, a note for one. */
function TrendCell({ trend, flagged }: { trend: Trend; flagged: boolean }) {
  if (trend.kind === "sparkline") {
    return <Sparkline values={trend.values} status={flagged ? "watch" : undefined} width={72} />;
  }
  if (trend.kind === "delta") {
    const Icon = DELTA_ICONS[trend.direction];
    return (
      <span className="flex items-center gap-1.5 text-xs leading-tight whitespace-nowrap text-ink tabular-nums">
        <Icon size={14} aria-hidden className="shrink-0" />
        <span>
          {trend.direction === "flat"
            ? "No change"
            : `${trend.direction === "up" ? "Up" : "Down"} ${formatLabValue(trend.amount)}`}
          <span className="block text-muted">since {formatDate(trend.since)}</span>
        </span>
      </span>
    );
  }
  if (trend.kind === "first") return <span className="text-xs text-muted">First reading</span>;
  return null;
}

export function LabRow({ metric }: { metric: LabMetric }) {
  const { latest, flag, name } = metric;
  const value = formatLabValue(latest.value);
  const unit = latest.unit?.trim();
  const to = metric.slug === PSA_METRIC_SLUG ? "/labs/psa" : `/labs/${metric.slug}`;
  const trend = trendFor(metric.series);

  return (
    <li
      data-lab-row={metric.slug}
      data-flag={flag}
      className="group/row flex items-center gap-2 px-4 py-3 transition-colors duration-200 ease-out hover:bg-secondary/60 sm:gap-3 sm:px-5"
    >
      <Link
        to={to}
        className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_10.5rem_6.5rem]"
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

        <span className="hidden min-h-9 items-center md:flex">
          <TrendCell trend={trend} flagged={!!flag} />
        </span>

        <span className="col-span-2 text-xs text-muted tabular-nums md:col-span-1 md:text-right">
          {latest.date ? formatDate(latest.date) : "No date"}
        </span>
      </Link>

      <button
        type="button"
        aria-label={`Ask about this ${name}`}
        onClick={() =>
          openAssistant({
            label: `${name} result`,
            prompt: `What does my latest ${name} result of ${value}${unit ? ` ${unit}` : ""} mean?`,
          })
        }
        className="inline-flex h-9 shrink-0 items-center justify-end gap-1.5 rounded-xl px-2.5 text-xs font-medium text-muted transition-colors duration-200 ease-out hover:bg-secondary hover:text-ink focus-visible:bg-secondary focus-visible:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:w-[8.25rem]"
      >
        <span
          aria-hidden
          className="hidden text-ink opacity-0 transition-opacity duration-150 ease-out group-focus-within/row:opacity-100 group-hover/row:opacity-100 md:inline"
        >
          Ask about this
        </span>
        <Sparkles size={16} aria-hidden />
      </button>
    </li>
  );
}
