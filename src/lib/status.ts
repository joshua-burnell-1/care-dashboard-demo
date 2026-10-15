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

export type StatusInput = {
  latestPsa: number | null;
  doublingMonths: number | null;
  readinessLine: number;
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

/** PSA values with up to three decimals, as ultrasensitive assays report them. */
export function formatPsa(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
}

function levelFor({ latestPsa, doublingMonths, readinessLine }: StatusInput): StatusLevel {
  // psaDoublingMonths returns null unless the series is rising.
  const rising = doublingMonths != null;
  if ((latestPsa != null && latestPsa >= readinessLine) || (rising && doublingMonths < 3)) {
    return "act";
  }
  if ((rising && doublingMonths < 6) || (latestPsa != null && latestPsa > 0 && rising)) {
    return "watch";
  }
  return "stable";
}

function leadFor({ latestPsa, doublingMonths, readinessLine }: StatusInput): string {
  if (latestPsa == null) return "No PSA results yet.";
  const psa = `PSA ${formatPsa(latestPsa)}`;
  if (latestPsa >= readinessLine) {
    return `${psa}, at or above the ${readinessLine.toFixed(2)} scan readiness line.`;
  }
  if (doublingMonths != null) {
    const pace =
      doublingMonths < 1 ? "in under a month" : `about every ${doublingMonths.toFixed(1)} months`;
    return `${psa} and rising, doubling ${pace}.`;
  }
  return `${psa} and holding steady.`;
}

export function computeStatus(input: StatusInput): Status {
  const lead = leadFor(input);
  const nextStep = input.nextStep
    ? `Next step: ${input.nextStep.title} on ${formatDate(input.nextStep.date)}.`
    : null;
  return {
    level: levelFor(input),
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

/** The latest value against the one before it. The series must have at least one point. */
export function computeDelta(series: { date: string; value: number }[]): Delta {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted[sorted.length - 1].value;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2].value : null;
  if (previous == null) return { current, previous, change: null, direction: "flat" };
  // Round away float noise (0.11 - 0.085 is 0.025000000000000008).
  const change = Number((current - previous).toFixed(6));
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  return { current, previous, change, direction };
}

/** The Learn page's doubling-time bands, collapsed to a status level and a one-word label. */
export function doublingBand(months: number | null): { level: StatusLevel; label: string } | null {
  if (months == null) return null;
  if (months < 3) return { level: "act", label: "Fast" };
  if (months < 6) return { level: "watch", label: "Moderate" };
  return { level: "stable", label: "Slow" };
}
