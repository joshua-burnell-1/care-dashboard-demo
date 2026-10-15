// ABOUTME: PSA doubling time from a series of readings, by a least-squares fit of
// ABOUTME: log(PSA) against time across every reading rather than the last two.

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;

type Reading = { date: string; value: number | null };

/** Minimum variance of reading times, in months squared: two readings under ~1.5 hours apart give no trend. */
const MIN_TIME_VARIANCE = 1e-6;

/** Months for the PSA to double across the series, or null if it is not rising. */
export function psaDoublingMonths(readings: Reading[]): number | null {
  const valid = readings.filter(
    (r): r is { date: string; value: number } => r.value != null && r.value > 0,
  );
  if (valid.length < 2) return null;
  // Times relative to the first reading keep the fit well-conditioned.
  const t0 = new Date(valid[0].date).getTime();
  const pts = valid.map((r) => ({
    t: (new Date(r.date).getTime() - t0) / MS_PER_MONTH,
    y: Math.log(r.value),
  }));
  const meanT = pts.reduce((s, p) => s + p.t, 0) / pts.length;
  const meanY = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  let cov = 0;
  let varT = 0;
  for (const p of pts) {
    cov += (p.t - meanT) * (p.y - meanY);
    varT += (p.t - meanT) ** 2;
  }
  if (varT / pts.length < MIN_TIME_VARIANCE) return null;
  const slope = cov / varT; // natural-log units per month
  return slope > 0 ? Math.LN2 / slope : null;
}

export function formatDoublingTime(months: number): string {
  return months < 1 ? "<1 mo" : `~${months.toFixed(1)} mo`;
}
