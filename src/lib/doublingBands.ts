// ABOUTME: The doubling-time bands Learn explains, derived from the same constants and doublingBand
// ABOUTME: Today and Labs use, so the copy can never disagree with the status scale.
import {
  FAST_DOUBLING_MONTHS,
  MODERATE_DOUBLING_MONTHS,
  doublingBand,
  type StatusLevel,
} from "./status";

export type DoublingBandRow = {
  label: string;
  level: StatusLevel;
  /** Months, inclusive. */
  min: number;
  /** Months, exclusive. */
  max: number;
  note: string;
};

function row(months: number, max: number, note: string): DoublingBandRow {
  const band = doublingBand(months)!;
  return { ...band, min: months, max, note };
}

/** Fast to slow, in the order the doubling time grows. */
export const DOUBLING_BAND_ROWS: DoublingBandRow[] = [
  row(
    0,
    FAST_DOUBLING_MONTHS,
    "The PSA is rising quickly. Treatment is usually recommended once the disease is located.",
  ),
  row(
    FAST_DOUBLING_MONTHS,
    MODERATE_DOUBLING_MONTHS,
    "Worth watching closely. Imaging and a treatment plan are usually discussed.",
  ),
  row(
    MODERATE_DOUBLING_MONTHS,
    Infinity,
    "The PSA is rising slowly. Watchful monitoring is usually enough.",
  ),
];

/** "Under 2 months", "2 to 6 months" or "Over 6 months". */
export function doublingRangeLabel(band: DoublingBandRow): string {
  if (band.min === 0) return `Under ${band.max} months`;
  if (!Number.isFinite(band.max)) return `Over ${band.min} months`;
  return `${band.min} to ${band.max} months`;
}
