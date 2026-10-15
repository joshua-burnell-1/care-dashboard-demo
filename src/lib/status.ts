// ABOUTME: Today's at-a-glance status: a stable / watch / act level and one-sentence headline from
// ABOUTME: the latest PSA and doubling time, plus the delta and doubling-band helpers the tiles use.
import { formatDate } from "./format";

/** The PSA level (ng/mL) at which a PSMA PET/CT becomes more likely to find the source. */
export const PSA_READINESS_LINE = 0.2;

export type StatusLevel = "stable" | "watch" | "act";

/** The words a status chip shows. Severity is never carried by color alone. */
export const STATUS_LABELS: Record<StatusLevel, string> = {
  stable: "Stable",
  watch: "Keep watching",
  act: "Needs attention",
};

/** A PSA reading's phase in words, keyed by the stored value. */
export const PSA_PHASE_LABELS: Record<string, string> = {
  "pre-op": "Before surgery",
  "post-op": "After surgery",
  "post-rad": "After radiation",
};

/** A PSA reading with a value; `phase` is "pre-op", "post-op" or "post-rad". */
export type ValuedReading = { date: string; value: number; phase?: string };

export type StatusInput = {
  latestPsa: number | null;
  doublingMonths: number | null;
  readinessLine: number;
  /**
   * The valued readings, any order. The latest change between them decides "rising", so a rise
   * before radiation or a fall after it reads correctly whatever the doubling fit says.
   */
  readings?: ValuedReading[];
  /** The next plan item, quoted at the end of the headline. */
  nextStep?: { title: string; date: string } | null;
};

export type Status = {
  level: StatusLevel;
  /** The whole one-line answer: `lead` then `nextStep`. */
  headline: string;
  /** How the PSA is doing, as one sentence. */
  lead: string;
  /** "Next step: ... on <date>." or null when nothing is planned. */
  nextStep: string | null;
};

/** Doubling faster than this (months) is the decision tree's trigger to move a visit earlier. */
export const FAST_DOUBLING_MONTHS = 2;
/** Doubling faster than this (months) is worth watching. */
export const MODERATE_DOUBLING_MONTHS = 6;

/** PSA values with up to three decimals, as ultrasensitive assays report them. */
export function formatPsa(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
}

function levelFor(
  { latestPsa, doublingMonths, readinessLine }: StatusInput,
  delta: Delta | null,
): StatusLevel {
  const rising = delta?.direction === "up";
  const fast = doublingMonths != null && doublingMonths < FAST_DOUBLING_MONTHS;
  if ((latestPsa != null && latestPsa >= readinessLine) || fast) return "act";
  const moderate = doublingMonths != null && doublingMonths < MODERATE_DOUBLING_MONTHS;
  if (moderate || (latestPsa != null && latestPsa > 0 && rising)) return "watch";
  return "stable";
}

function doublingPace(months: number): string {
  return months < 1 ? "in under a month" : `about every ${months.toFixed(1)} months`;
}

function leadFor(
  { latestPsa, doublingMonths, readinessLine, readings }: StatusInput,
  delta: Delta | null,
): string {
  if (latestPsa == null) return "No PSA results yet.";
  const psa = `PSA ${formatPsa(latestPsa)}`;
  if (latestPsa >= readinessLine) {
    return `${psa}, at or above the ${readinessLine.toFixed(2)} scan readiness line.`;
  }
  // Without the readings there is no direction to report, only the fitted pace.
  if (!readings) {
    return doublingMonths != null ? `${psa}, doubling ${doublingPace(doublingMonths)}.` : `${psa}.`;
  }
  if (delta?.previous == null) return `${psa}, the only reading so far.`;
  const previous = formatPsa(delta.previous);
  if (delta.direction === "down") return `${psa}, down from ${previous}.`;
  if (delta.direction === "flat") return `${psa} and holding steady.`;
  if (doublingMonths != null) return `${psa} and rising, doubling ${doublingPace(doublingMonths)}.`;
  const latest = [...readings].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const postRad = readings.filter((r) => r.phase === "post-rad").length;
  if (latest?.phase === "post-rad" && postRad === 1) {
    return `${psa}, up from ${previous}, with one reading since radiation.`;
  }
  return `${psa} and rising, up from ${previous}.`;
}

export function computeStatus(input: StatusInput): Status {
  const delta = input.readings ? computeDelta(input.readings) : null;
  const lead = leadFor(input, delta);
  const nextStep = input.nextStep
    ? `Next step: ${input.nextStep.title} on ${formatDate(input.nextStep.date)}.`
    : null;
  return {
    level: levelFor(input, delta),
    lead,
    nextStep,
    headline: nextStep ? `${lead} ${nextStep}` : lead,
  };
}

export type Delta = {
  current: number;
  previous: number | null;
  change: number | null;
  direction: "up" | "down" | "flat";
};

/** The latest value against the one before it, or null for an empty series. */
export function computeDelta(series: { date: string; value: number }[]): Delta | null {
  if (series.length === 0) return null;
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted[sorted.length - 1].value;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2].value : null;
  if (previous == null) return { current, previous, change: null, direction: "flat" };
  // Round away float noise (0.11 - 0.085 is 0.025000000000000008).
  const change = Number((current - previous).toFixed(6));
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  return { current, previous, change, direction };
}

/** The doubling time as a status level and a one-word label, on the same scale as computeStatus. */
export function doublingBand(months: number | null): { level: StatusLevel; label: string } | null {
  if (months == null) return null;
  if (months < FAST_DOUBLING_MONTHS) return { level: "act", label: "Fast" };
  if (months < MODERATE_DOUBLING_MONTHS) return { level: "watch", label: "Moderate" };
  return { level: "stable", label: "Slow" };
}
