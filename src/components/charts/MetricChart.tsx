// ABOUTME: One lab metric over real time: the same time-scaled axis and dashed gap bridges as the
// ABOUTME: PSA chart, with the printed reference range as a shaded band. Used on the metric page.
import { useId, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate } from "@/lib/format";
import { formatLabValue } from "@/lib/labs";
import { prefersReducedMotion } from "@/lib/motion";
import { niceRange, timeToIso, toTimeDomain, withGaps } from "@/lib/timeDomain";

type TooltipProps = {
  active?: boolean;
  payload?: { payload?: { date: string; value: number | null } }[];
  unit?: string;
};

function MetricTooltip({ active, payload, unit }: TooltipProps) {
  const point = payload?.[0]?.payload;
  // Gap breakers carry no reading.
  if (!active || !point || point.value == null) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink shadow-lg">
      <p className="text-muted">{formatDate(point.date, "long")}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">
        {formatLabValue(point.value)}
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
}

type DotProps = { cx?: number; cy?: number; index?: number };

export function MetricChart({
  name,
  series,
  unit,
  range,
  height = 280,
}: {
  name: string;
  series: { date: string; value: number }[];
  unit?: string;
  /** The reference range's numbers, drawn as a band; either end may be open. */
  range?: { low?: number; high?: number } | null;
  height?: number;
}) {
  const [reduceMotion] = useState(prefersReducedMotion);
  const gradientId = `metric-fill-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { points, domain, ticks } = useMemo(
    () => toTimeDomain(series, [], { maxTicks: 6 }),
    [series],
  );
  const rows = useMemo(() => withGaps(points), [points]);

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted"
        style={{ height }}
      >
        No numeric readings to chart.
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const lows = [...values, ...(range?.low != null ? [range.low] : [])];
  const highs = [...values, ...(range?.high != null ? [range.high] : [])];
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  // A metric that never goes negative keeps its axis from dipping below zero.
  const axis = niceRange(min, max);
  const yDomain: [number, number] = [
    min >= 0 ? Math.max(0, axis.domain[0]) : axis.domain[0],
    axis.domain[1],
  ];
  const first = points[0];
  const last = points[points.length - 1];
  const summary = `${name} chart from ${formatDate(first.date)} to ${formatDate(last.date)}: ${points.length} reading${points.length === 1 ? "" : "s"}, latest ${formatLabValue(last.value)}${unit ? ` ${unit}` : ""}.`;
  const lastIndex = rows.length - 1;

  return (
    <div role="img" aria-label={summary} className="w-full select-none" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          accessibilityLayer={false}
          margin={{ top: 14, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--data)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--data)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          {range && (
            <ReferenceArea
              y1={range.low ?? yDomain[0]}
              y2={range.high ?? yDomain[1]}
              fill="var(--stable)"
              fillOpacity={0.1}
              stroke="none"
            />
          )}
          <XAxis
            type="number"
            dataKey="x"
            scale="time"
            domain={domain}
            ticks={ticks.length ? ticks : points.map((p) => p.x)}
            allowDataOverflow
            tickFormatter={(t: number) => formatDate(timeToIso(t), "monthYear")}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            width={44}
            domain={yDomain}
            ticks={axis.ticks.filter((t) => t >= yDomain[0])}
            tickFormatter={(v: number) => formatLabValue(Number(v.toFixed(2)))}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
            tickMargin={6}
          />
          <Tooltip
            content={<MetricTooltip unit={unit} />}
            cursor={{ stroke: "var(--muted)", strokeOpacity: 0.5, strokeDasharray: "3 3" }}
            isAnimationActive={false}
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
                    r={latest ? 5 : 4}
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
