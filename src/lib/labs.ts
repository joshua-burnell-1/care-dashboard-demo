// ABOUTME: Lab results as the Labs pages see them: the one URL slug for a metric, merging uploaded
// ABOUTME: and cached rows, grouping by panel with search, filters and sort, and paginating.
import type { LabResult as UploadedLab } from "@/hooks/useLabResults";
import { canonicalMetricKey, canonicalMetricLabel } from "./normalizeMetric";

/** One reading of one lab metric, whether it came from an upload or the medical cache. */
export type LabResult = {
  date?: string;
  metric: string;
  category?: string;
  value: number | string | null;
  unit?: string;
  reference_range?: string;
  flag?: string;
  source?: string;
  note?: string;
};

/** "abnormal" is a flag raised without a direction ("Abnormal", "Outside normal limits"). */
export type LabFlag = "high" | "low" | "abnormal";

export type LabMetric = {
  slug: string;
  name: string;
  /** The newest reading (uploaded rows win a tie). */
  latest: LabResult;
  /** Numeric, dated readings, oldest first. */
  series: { date: string; value: number }[];
  /** Every reading, newest first. */
  readings: LabResult[];
  /** Set when the newest reading is outside its reference range. */
  flag?: LabFlag;
};

export type LabGroup = { panel: string; metrics: LabMetric[] };

export type LabSort = "date" | "name";

export type LabFilters = { q?: string; panel?: string; abnormal?: boolean; sort?: LabSort };

/** The panel a result with no category is listed under. */
export const OTHER_PANEL = "Other";

/** URL-safe slug for a metric: its canonical key with anything but letters and digits as "-". */
export function metricSlug(metric: string): string {
  return canonicalMetricKey(metric)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The slug of the PSA lab row. PSA has its own deep dive at /labs/psa, so this slug leads there. */
export const PSA_METRIC_SLUG = metricSlug("PSA Total");

/**
 * The flag a lab raised: "high" or "low" when it says which way, "abnormal" when it only says
 * something is off (negations such as "Outside normal limits" and "Not within range" count),
 * and undefined for normal, blank or unknown flags.
 */
export function normalizeFlag(flag?: string | null): LabFlag | undefined {
  const f = (flag ?? "").trim().toLowerCase();
  if (!f) return undefined;
  if (f === "l" || f === "ll" || /\blow\b/.test(f)) return "low";
  if (f === "h" || f === "hh" || /\bhigh\b/.test(f)) return "high";
  if (/\b(abnormal|critical|flagged|outside|out of|not)\b/.test(f)) return "abnormal";
  return undefined;
}

export const FLAG_LABELS: Record<LabFlag, string> = {
  high: "High",
  low: "Low",
  abnormal: "Flagged",
};

/** A reading's value for display: numbers to three decimals (ultrasensitive assays), text as is. */
export function formatLabValue(value: LabResult["value"]): string {
  if (value == null || value === "") return "None";
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
  }
  return value;
}

export type LabStatus = { level: "watch" | "stable" | "neutral"; label: string };

/**
 * The chip a reading earns: High, Low or Flagged when the lab flagged it (negations are checked
 * first, so "Not within range" is abnormal), In range when the lab said normal or the number
 * sits inside its printed range, and a neutral "No flag" otherwise.
 */
export function labStatus(reading: LabResult): LabStatus {
  const flag = normalizeFlag(reading.flag);
  if (flag) return { level: "watch", label: FLAG_LABELS[flag] };
  if (/\b(normal|within)\b/i.test(reading.flag ?? ""))
    return { level: "stable", label: "In range" };
  const range = parseReferenceRange(reading.reference_range);
  const value = numericValue(reading.value);
  if (range && value != null) {
    const inside =
      (range.low == null || value >= range.low) && (range.high == null || value <= range.high);
    if (inside) return { level: "stable", label: "In range" };
  }
  return { level: "neutral", label: "No flag" };
}

function numericValue(value: LabResult["value"]): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(value)) return Number(value);
  return null;
}

/**
 * The numbers in a printed reference range, for drawing a band on a chart: "4.0–11.0" is
 * a low and a high, "≥60" only a low, "<0.10 after treatment" only a high.
 */
export function parseReferenceRange(range?: string): { low?: number; high?: number } | null {
  const text = (range ?? "").trim();
  if (!text) return null;
  const number = "(\\d+(?:\\.\\d+)?)";
  const both = new RegExp(`^${number}\\s*(?:[–—-]|to)\\s*${number}`).exec(text);
  if (both) return { low: Number(both[1]), high: Number(both[2]) };
  const atLeast = new RegExp(`^(?:≥|>=|>)\\s*${number}`).exec(text);
  if (atLeast) return { low: Number(atLeast[1]) };
  const atMost = new RegExp(`^(?:≤|<=|<)\\s*${number}`).exec(text);
  if (atMost) return { high: Number(atMost[1]) };
  return null;
}

/** Adapt an uploaded `lab_results` row to a reading. A blank source is labeled "upload". */
function fromUpload(r: UploadedLab): LabResult {
  return {
    date: r.date ?? undefined,
    metric: r.metric,
    category: r.category ?? undefined,
    value: r.value_numeric ?? r.value_text ?? null,
    unit: r.unit || undefined,
    reference_range: r.reference_range ?? undefined,
    flag: r.flag ?? undefined,
    source: r.source || "upload",
    note: r.note || undefined,
  };
}

/**
 * Uploaded rows plus the cached ones, as one list. Uploaded rows come first so they win a
 * repeat of the same metric, day and value: those are the ones the family just approved.
 */
export function mergeLabs(uploaded: UploadedLab[], cached: LabResult[]): LabResult[] {
  const seen = new Set<string>();
  const merged: LabResult[] = [];
  for (const row of [...uploaded.map(fromUpload), ...cached]) {
    const key = `${row.date ?? ""}|${canonicalMetricKey(row.metric)}|${row.value ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}

const byDateDesc = (a: LabResult, b: LabResult) => (b.date ?? "").localeCompare(a.date ?? "");

function buildMetric(slug: string, rows: LabResult[]): LabMetric {
  // Array sort is stable, so on equal dates the earlier (uploaded) row stays first.
  const readings = [...rows].sort(byDateDesc);
  const latest = readings[0];
  const series = readings
    .flatMap((r) => {
      const value = numericValue(r.value);
      return r.date && value != null ? [{ date: r.date.slice(0, 10), value }] : [];
    })
    .reverse();
  return {
    slug,
    name: canonicalMetricLabel(latest.metric),
    latest,
    series,
    readings,
    flag: normalizeFlag(latest.flag),
  };
}

function panelOf(metric: LabMetric): string {
  return (
    metric.latest.category?.trim() ||
    metric.readings.find((r) => r.category?.trim())?.category?.trim() ||
    OTHER_PANEL
  );
}

function searchText(metric: LabMetric, panel: string): string {
  const parts = [metric.name, panel];
  for (const r of metric.readings) parts.push(r.metric, r.source ?? "");
  return parts.join("\n").toLowerCase();
}

/**
 * Lab readings as panel groups, one entry per metric (name variants share one), filtered by
 * search text (every word must appear in the name, panel or a source), panel and abnormal-only.
 * Panels are alphabetical with "Other" last; within a panel metrics run newest first or by name.
 */
export function groupLabs(labs: LabResult[], opts: LabFilters = {}): LabGroup[] {
  const bySlug = new Map<string, LabResult[]>();
  for (const row of labs) {
    const slug = metricSlug(row.metric ?? "");
    if (!slug) continue;
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), row]);
  }

  const words = (opts.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const byPanel = new Map<string, LabMetric[]>();
  for (const [slug, rows] of bySlug) {
    const metric = buildMetric(slug, rows);
    const panel = panelOf(metric);
    if (opts.panel && panel !== opts.panel) continue;
    if (opts.abnormal && !metric.flag) continue;
    if (words.length) {
      const text = searchText(metric, panel);
      if (!words.every((w) => text.includes(w))) continue;
    }
    byPanel.set(panel, [...(byPanel.get(panel) ?? []), metric]);
  }

  const byName = (a: LabMetric, b: LabMetric) => a.name.localeCompare(b.name);
  const compare =
    opts.sort === "name"
      ? byName
      : (a: LabMetric, b: LabMetric) => byDateDesc(a.latest, b.latest) || byName(a, b);
  return [...byPanel]
    .map(([panel, metrics]) => ({ panel, metrics: metrics.sort(compare) }))
    .sort((a, b) => {
      if (a.panel === OTHER_PANEL) return 1;
      if (b.panel === OTHER_PANEL) return -1;
      return a.panel.localeCompare(b.panel);
    });
}

/** One page of `items`; a page outside 1..pages (or not a number) is clamped into range. */
export function paginate<T>(
  items: T[],
  page: number,
  size: number,
): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const wanted = Number.isFinite(page) ? Math.floor(page) : 1;
  const current = Math.min(Math.max(1, wanted), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages };
}

/**
 * One page of grouped metrics, counted by metric rather than by group. A group that
 * straddles a page break appears on both pages under its own heading.
 */
export function paginateGroups(
  groups: LabGroup[],
  page: number,
  size: number,
): { groups: LabGroup[]; page: number; pages: number; total: number } {
  const flat = groups.flatMap((g) => g.metrics.map((metric) => ({ panel: g.panel, metric })));
  const paged = paginate(flat, page, size);
  const onPage: LabGroup[] = [];
  for (const { panel, metric } of paged.items) {
    const last = onPage[onPage.length - 1];
    if (last?.panel === panel) last.metrics.push(metric);
    else onPage.push({ panel, metrics: [metric] });
  }
  return { groups: onPage, page: paged.page, pages: paged.pages, total: flat.length };
}

/** How a row shows a metric's trend: a sparkline needs three points to say anything about shape. */
export type Trend =
  | { kind: "sparkline"; values: number[] }
  | { kind: "delta"; direction: "up" | "down" | "flat"; amount: number; since: string }
  | { kind: "first" }
  | { kind: "none" };

/**
 * Three or more numeric readings draw a sparkline. Two would always draw the same diagonal
 * whatever the size of the change, so they show the change itself. One is the first reading.
 */
export function trendFor(series: { date: string; value: number }[]): Trend {
  if (series.length >= 3) return { kind: "sparkline", values: series.map((p) => p.value) };
  if (series.length === 2) {
    const [before, after] = series;
    // Round away float noise (0.11 - 0.085 is 0.025000000000000008).
    const change = Number((after.value - before.value).toFixed(6));
    return {
      kind: "delta",
      direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
      amount: Math.abs(change),
      since: before.date,
    };
  }
  return series.length === 1 ? { kind: "first" } : { kind: "none" };
}
