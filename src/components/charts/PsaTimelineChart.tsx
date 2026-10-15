// ABOUTME: PSA over real time: a numeric date axis (so a nine-month gap looks nine months wide),
// ABOUTME: treatment events as labeled markers, dashed bridges over long gaps, and the readiness line.
import { useId, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TreatmentEvent } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/motion";
import { formatPsa } from "@/lib/status";
import {
  dateToTime,
  layoutEventLabels,
  niceTicks,
  timeToIso,
  toTimeDomain,
  withGaps,
} from "@/lib/timeDomain";

export type PsaTimelineReading = { date: string; value: number | null; note?: string };

/** About how wide one event label is, in pixels, for spacing labels onto rows. */
const LABEL_WIDTH_PX = 120;
const LABEL_ROW_PX = 15;

function axisPsa(value: number): string {
  return value === 0 ? "0" : value.toFixed(2);
}

type EventLabelProps = {
  text: string;
  row: number;
  anchor: "start" | "end";
  viewBox?: { x?: number; y?: number };
};

/** An event's label, set above the plot on its row, beside a small tick at the top of its line. */
function EventLabel({ text, row, anchor, viewBox }: EventLabelProps) {
  const x = viewBox?.x ?? 0;
  const top = viewBox?.y ?? 0;
  const y = top - 14 - row * LABEL_ROW_PX;
  return (
    <g>
      <line x1={x} x2={x} y1={y + 2} y2={top} stroke="var(--muted)" strokeOpacity={0.5} />
      <circle cx={x} cy={y + 2} r={2.5} fill="var(--muted)" />
      <text
        x={anchor === "start" ? x + 6 : x - 6}
        y={y + 5}
        textAnchor={anchor}
        fontSize={11}
        fill="var(--muted)"
      >
        {text}
      </text>
    </g>
  );
}

/**
 * The readiness line's label, just below the line at the right, ending before any event marker
 * near the right edge so the two never overlap.
 */
function ReadinessLabel({
  text,
  endFraction,
  viewBox,
}: {
  text: string;
  endFraction: number;
  viewBox?: { x?: number; y?: number; width?: number };
}) {
  const x = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) * endFraction - 6;
  return (
    <text x={x} y={(viewBox?.y ?? 0) + 15} textAnchor="end" fontSize={11} fill="var(--muted)">
      {text}
    </text>
  );
}

type TooltipProps = {
  active?: boolean;
  payload?: { payload?: { date: string; value: number | null } }[];
  notes: Map<string, string>;
};

function PsaTooltip({ active, payload, notes }: TooltipProps) {
  const point = payload?.[0]?.payload;
  // Gap breakers carry no reading.
  if (!active || !point || point.value == null) return null;
  const note = notes.get(point.date);
  return (
    <div className="max-w-[220px] rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink shadow-lg">
      <p className="text-muted">{formatDate(point.date, "long")}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatPsa(point.value)} ng/mL</p>
      {note && <p className="mt-1 leading-relaxed text-muted">{note}</p>}
    </div>
  );
}

type DotProps = { cx?: number; cy?: number; index?: number };

export function PsaTimelineChart({
  readings,
  events,
  readinessLine,
  height = 300,
  compact = false,
}: {
  readings: PsaTimelineReading[];
  events: TreatmentEvent[];
  readinessLine: number;
  height?: number;
  /** Fewer ticks and smaller marks, for small cards. */
  compact?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const [reduceMotion] = useState(prefersReducedMotion);
  const gradientId = `psa-fill-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const maxTicks = compact ? 4 : Math.max(3, Math.min(8, Math.floor((width || 640) / 100)));
  const { points, domain, ticks } = useMemo(
    () =>
      toTimeDomain(
        readings,
        events.map((e) => e.date),
        { maxTicks },
      ),
    [readings, events, maxTicks],
  );
  const labels = useMemo(
    () =>
      layoutEventLabels(
        events.map((e) => dateToTime(e.date)),
        domain,
        { minGap: width ? LABEL_WIDTH_PX / width : 0.2 },
      ),
    [events, domain, width],
  );
  const notes = useMemo(
    () => new Map(readings.filter((r) => r.note).map((r) => [r.date.slice(0, 10), r.note!])),
    [readings],
  );

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted"
        style={{ height }}
      >
        No PSA results yet.
      </div>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const summary = [
    `PSA chart from ${formatDate(first.date)} to ${formatDate(last.date)}:`,
    `${points.length} readings, from ${formatPsa(first.value)} to ${formatPsa(last.value)} ng/mL.`,
    `Scan readiness line at ${readinessLine.toFixed(2)}.`,
    events.length
      ? `Markers: ${events.map((e) => `${e.label}, ${formatDate(e.date)}`).join("; ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  // Headroom above the readiness line (or the highest reading) keeps both off the top edge.
  const yTicks = niceTicks(Math.max(readinessLine, ...points.map((p) => p.value)) * 1.12);
  const labelRows = events.length ? Math.max(...labels.map((l) => l.row)) + 1 : 0;
  const rows = withGaps(points);
  const lastIndex = rows.length - 1;
  const span = domain[1] - domain[0] || 1;
  const nearRight = events
    .map((e) => (dateToTime(e.date) - domain[0]) / span)
    .filter((f) => f > 0.85);
  const readinessEnd = nearRight.length ? Math.min(...nearRight) : 1;

  return (
    <div role="img" aria-label={summary} className="w-full select-none" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" onResize={(w) => setWidth(w)}>
        <ComposedChart
          data={rows}
          accessibilityLayer={false}
          margin={{ top: 14 + labelRows * LABEL_ROW_PX, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--data)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--data)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            type="number"
            dataKey="x"
            scale="time"
            domain={domain}
            ticks={ticks}
            allowDataOverflow
            tickFormatter={(t: number) => formatDate(timeToIso(t), "monthYear")}
            tick={{ fontSize: compact ? 10 : 11, fill: "var(--muted)" }}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            width={44}
            domain={[0, yTicks[yTicks.length - 1]]}
            ticks={yTicks}
            tickFormatter={axisPsa}
            tick={{ fontSize: compact ? 10 : 11, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
            tickMargin={6}
          />
          <Tooltip
            content={<PsaTooltip notes={notes} />}
            cursor={{ stroke: "var(--muted)", strokeOpacity: 0.5, strokeDasharray: "3 3" }}
            isAnimationActive={false}
          />
          {events.map((e, i) => (
            <ReferenceLine
              key={`${e.kind}-${e.date}-${e.label}`}
              x={dateToTime(e.date)}
              stroke="var(--muted)"
              strokeOpacity={0.45}
              strokeDasharray="2 4"
              label={<EventLabel text={e.label} row={labels[i].row} anchor={labels[i].anchor} />}
            />
          ))}
          <ReferenceLine
            y={readinessLine}
            ifOverflow="extendDomain"
            stroke="var(--ink)"
            strokeOpacity={0.4}
            strokeDasharray="6 4"
            label={
              <ReadinessLabel
                text={`Scan readiness ${readinessLine.toFixed(2)}`}
                endFraction={readinessEnd}
              />
            }
          />
          <Line
            type="linear"
            dataKey="gap"
            stroke="var(--data)"
            strokeWidth={2}
            strokeOpacity={0.55}
            strokeDasharray="3 5"
            dot={false}
            activeDot={false}
            isAnimationActive={!reduceMotion}
          />
          <Area
            type="linear"
            dataKey="value"
            stroke="var(--data)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={!reduceMotion}
            activeDot={{ r: 5, fill: "var(--data)", stroke: "var(--surface)", strokeWidth: 2 }}
            dot={({ cx, cy, index }: DotProps) => {
              if (cx == null || cy == null) return <g key={`dot-${index}`} />;
              const latest = index === lastIndex;
              return (
                <g key={`dot-${index}`}>
                  {latest && <circle cx={cx} cy={cy} r={9} fill="var(--data)" opacity={0.15} />}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={latest ? 5 : compact ? 3 : 4}
                    fill="var(--data)"
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                </g>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
