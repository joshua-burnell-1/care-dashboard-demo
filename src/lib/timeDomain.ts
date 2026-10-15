// ABOUTME: Time-scale math for charts with a numeric date axis: readings as timestamps, a padded
// ABOUTME: domain that also covers event dates, month ticks, and collision-free event label rows.

const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** Local midnight of a `YYYY-MM-DD` (or ISO timestamp) calendar day, as epoch milliseconds. */
export function dateToTime(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** The local calendar day of a timestamp, as `YYYY-MM-DD` (what formatDate expects). */
export function timeToIso(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type TimePoint = { x: number; date: string; value: number };

export type TimeDomain = {
  points: TimePoint[];
  domain: [number, number];
  /** First-of-month timestamps inside the domain, evenly stepped. */
  ticks: number[];
};

const MONTH_STEPS = [1, 2, 3, 4, 6, 12, 24];

function monthTicks([start, end]: [number, number], maxTicks: number): number[] {
  const first = new Date(start);
  const cursor = new Date(first.getFullYear(), first.getMonth() + 1, 1);
  const months: number[] = [];
  while (cursor.getTime() <= end) {
    months.push(cursor.getTime());
    cursor.setMonth(cursor.getMonth() + 1);
  }
  if (months.length === 0) return [];
  // Align to calendar months divisible by the step (Jan, Apr, Jul, Oct for 3) so ticks read
  // evenly, and take the finest step that fits.
  const aligned = (step: number) =>
    step > 12
      ? months.filter((_, i) => i % step === 0)
      : months.filter((t) => new Date(t).getMonth() % step === 0);
  for (const step of MONTH_STEPS) {
    const ticks = aligned(step);
    if (ticks.length <= maxTicks) return ticks;
  }
  return aligned(24);
}

export function toTimeDomain(
  readings: { date: string; value: number | null }[],
  eventDates: string[] = [],
  { maxTicks = 6, padRatio = 0.02 }: { maxTicks?: number; padRatio?: number } = {},
): TimeDomain {
  const points = readings
    .filter((r): r is { date: string; value: number } => r.value != null)
    .map((r) => ({ x: dateToTime(r.date), date: r.date.slice(0, 10), value: r.value }))
    .sort((a, b) => a.x - b.x);
  const all = [...points.map((p) => p.x), ...eventDates.map(dateToTime)];
  if (all.length === 0) return { points, domain: [0, 0], ticks: [] };
  const min = Math.min(...all);
  const max = Math.max(...all);
  // Pad both ends so dots and event lines at the edges are not clipped.
  const padding = Math.max((max - min) * padRatio, DAY_MS);
  const domain: [number, number] = [min - padding, max + padding];
  return { points, domain, ticks: monthTicks(domain, Math.max(2, maxTicks)) };
}

export type EventLabelLayout = { row: number; anchor: "start" | "end" };

/**
 * Rows and text anchors for event labels: a label closer than `minGap` (a fraction of the
 * domain) to the previous label on a row moves to the next row, and labels in the right-hand
 * part of the chart anchor at their end so the text stays inside the plot.
 */
export function layoutEventLabels(
  times: number[],
  [start, end]: [number, number],
  { minGap = 0.14, maxRows = 3 }: { minGap?: number; maxRows?: number } = {},
): EventLabelLayout[] {
  const span = end - start || 1;
  const lastOnRow: number[] = [];
  return times.map((t) => {
    const f = (t - start) / span;
    let row = lastOnRow.findIndex((last) => f - last >= minGap);
    if (row === -1) row = Math.min(lastOnRow.length, maxRows - 1);
    lastOnRow[row] = f;
    return { row, anchor: f > 0.75 ? "end" : "start" };
  });
}

/** Evenly stepped ticks from 0 that reach at least `max`, on a 1, 2, 2.5 or 5 step. */
export function niceTicks(max: number, count = 5): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let i = 0; ticks.length === 0 || ticks[ticks.length - 1] < max - 1e-12; i++) {
    ticks.push(Number((i * step).toFixed(10)));
  }
  return ticks;
}
