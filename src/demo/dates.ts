// ABOUTME: Date helpers for the demo seed. Every seeded date is an offset from
// ABOUTME: "today" so the fictional timeline never goes stale.

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** `YYYY-MM-DD` for `offset` days from `today`, in local time (DST-safe). */
export function isoDaysFromToday(offset: number, today: Date = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO timestamp (`...Z`) at a fixed clock time on the day `offset` days from `today`. */
export function timestampDaysFromToday(
  offset: number,
  today: Date = new Date(),
  time = "09:00:00",
): string {
  return `${isoDaysFromToday(offset, today)}T${time}.000Z`;
}

function parts(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return { year, month, day };
}

/** `October 14, 2026` */
export function formatLongDate(iso: string): string {
  const { year, month, day } = parts(iso);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/** `Oct 14` */
export function formatShortDate(iso: string): string {
  const { month, day } = parts(iso);
  return `${MONTHS[month - 1].slice(0, 3)} ${day}`;
}

/** `Oct 14 2026`, the compact label the PSA chart uses. */
export function formatCompactDate(iso: string): string {
  const { year } = parts(iso);
  return `${formatShortDate(iso)} ${year}`;
}

/** `October 2026` */
export function formatMonthYear(iso: string): string {
  const { year, month } = parts(iso);
  return `${MONTHS[month - 1]} ${year}`;
}

/** A moment in the past: days from today plus a clock time. */
export type Moment = { offset: number; time: string };

export function editTimestamp(moment: Moment, today: Date = new Date()): string {
  return timestampDaysFromToday(moment.offset, today, moment.time);
}

/** Local noon on a `YYYY-MM-DD` day, so day arithmetic never trips over DST. */
export function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Whole calendar days from `fromIso` to `toIso` (both `YYYY-MM-DD`). */
export function daysBetween(fromIso: string, toIso: string): number {
  const utc = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(toIso) - utc(fromIso)) / 86400000);
}
