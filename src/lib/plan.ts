// ABOUTME: Pure helpers for the Plan pages: the timeline split (overdue, upcoming, ongoing, past),
// ABOUTME: the status chip and date badge for a plan item, and the aligned specialist comparison.
import type { ChipLevel } from "@/components/StatusChip";
import type { PlanItem } from "@/hooks/usePlanItems";
import { formatDate } from "./format";

/** Every status a plan item can have, in the order the editors offer them. */
export const PLAN_STATUSES = [
  "Locked",
  "Scheduled",
  "In flight",
  "Conditional",
  "Hold",
  "Daily",
  "Completed",
] as const;

/** Statuses that make a dated item overdue once its date has passed. */
const OVERDUE_STATUSES = ["Scheduled", "In flight"];

/** `today` is a local `YYYY-MM-DD` day, so plain string comparison orders dates correctly. */
export function isOverdue(item: PlanItem, today: string): boolean {
  if (!item.event_date || item.event_date >= today) return false;
  return OVERDUE_STATUSES.includes(item.status);
}

export type TimelineBuckets = {
  /** Dated, still open, and past due. Oldest first. */
  overdue: PlanItem[];
  /** Dated and open, not overdue (includes today). Soonest first. */
  upcoming: PlanItem[];
  /** Open items with no date (daily routines, holds). Input order. */
  ongoing: PlanItem[];
  /** Completed items. Most recent first, undated last. */
  past: PlanItem[];
};

/**
 * Splits plan items into four buckets. A superset of `{ upcoming, past }`: the old page kept
 * overdue and undated items apart from the upcoming ones, and so does this. A dated item whose
 * date has passed but whose status is not Scheduled or In flight (say, Hold) stays in `upcoming`.
 */
export function splitTimeline(items: PlanItem[], today: string): TimelineBuckets {
  const byDate = (a: PlanItem, b: PlanItem) =>
    (a.event_date ?? "").localeCompare(b.event_date ?? "") || a.sort_index - b.sort_index;
  const open = items.filter((i) => i.status !== "Completed");
  const dated = open.filter((i) => i.event_date);
  return {
    overdue: dated.filter((i) => isOverdue(i, today)).sort(byDate),
    upcoming: dated.filter((i) => !isOverdue(i, today)).sort(byDate),
    ongoing: open.filter((i) => !i.event_date),
    past: items
      .filter((i) => i.status === "Completed")
      .sort((a, b) => {
        if (!a.event_date || !b.event_date) return a.event_date ? -1 : b.event_date ? 1 : 0;
        return b.event_date.localeCompare(a.event_date);
      }),
  };
}

/** Only an open visit that is today or later has anything to prepare for. */
export function canPrepare(item: PlanItem, today: string): boolean {
  return !!item.event_date && item.event_date >= today && item.status !== "Completed";
}

/** The status as words plus a chip level. Overdue overrides whatever the stored status says. */
export function planChip(item: PlanItem, overdue: boolean): { level: ChipLevel; label: string } {
  if (overdue) return { level: "act", label: "Overdue" };
  switch (item.status) {
    case "In flight":
      return { level: "watch", label: item.status };
    case "Daily":
    case "Completed":
      return { level: "stable", label: item.status };
    default:
      return { level: "neutral", label: item.status };
  }
}

/** Month, day and year for a date badge, taken from the one app date format. */
export function dateBadge(iso: string): { month: string; day: string; year: string } | null {
  const match = /^([A-Za-z]+) (\d+), (\d+)$/.exec(formatDate(iso));
  return match ? { month: match[1], day: match[2], year: match[3] } : null;
}

/** The seed writes a clinician's meta line as "institution · date · role". */
export function parseClinicianMeta(meta: string): {
  institution: string;
  date: string | null;
  role: string | null;
} {
  const [institution, date, ...role] = meta.split(" · ");
  return {
    institution,
    date: date ? formatDate(date) || date : null,
    role: role.length > 0 ? role.join(" · ") : null,
  };
}

export type ComparisonRow = { topic: string; views: (string | null)[] };

/** Each clinician's own topic wording ("her plan", "his plan") reads as one shared topic. */
const normalizeTopic = (k: string) => k.replace(/\b(her|his)\b/gi, "their");

/** One row per topic, in the first clinician's order, each clinician's answer in their column. */
export function comparisonRows(
  clinicians: { rows: { k: string; v: string }[] }[],
): ComparisonRow[] {
  const topics: string[] = [];
  for (const c of clinicians)
    for (const r of c.rows) {
      const topic = normalizeTopic(r.k);
      if (!topics.includes(topic)) topics.push(topic);
    }
  return topics.map((topic) => ({
    topic,
    views: clinicians.map((c) => c.rows.find((r) => normalizeTopic(r.k) === topic)?.v ?? null),
  }));
}
