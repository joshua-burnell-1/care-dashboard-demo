export type DateStyle = "short" | "long" | "monthYear";

const FORMATS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { month: "short", day: "numeric", year: "numeric" },
  long: { month: "long", day: "numeric", year: "numeric" },
  monthYear: { month: "short", year: "numeric" },
};

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/** Parse an ISO date or timestamp as a local calendar date (no UTC shift). */
function parseLocalDate(iso: string): Date | null {
  const match = DATE_PREFIX.exec(iso);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whole calendar days since the epoch, immune to DST offsets. */
function calendarDay(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function formatDate(iso: string, style: DateStyle = "short"): string {
  const date = parseLocalDate(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", FORMATS[style]).format(date);
}

export function formatRelative(iso: string, today: Date = new Date()): string {
  const date = parseLocalDate(iso);
  if (!date) return "";
  const days = calendarDay(date) - calendarDay(today);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** Group thousands. With `digits`, pin the decimals; otherwise keep up to two. */
export function formatNumber(n: number, digits?: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? 2,
  }).format(n);
}
