// ABOUTME: The doubling-time bands as rows (status chip, range, plain-language meaning), with the
// ABOUTME: current estimate named and its band marked. Numbers come from the status scale.
import { StatusChip } from "@/components/StatusChip";
import { DOUBLING_BAND_ROWS, doublingRangeLabel } from "@/lib/doublingBands";
import { doublingBand } from "@/lib/status";

export function DoublingBands({
  months,
  firstName,
}: {
  /** The fitted post-radiation doubling time, or null when there is none. */
  months: number | null;
  firstName: string;
}) {
  const current = doublingBand(months);
  return (
    <>
      <ul className="mt-5 divide-y divide-line rounded-[20px] border border-line bg-surface px-5">
        {DOUBLING_BAND_ROWS.map((b) => {
          const here = current?.label === b.label;
          return (
            <li
              key={b.label}
              data-band={b.label}
              data-current={here ? "true" : undefined}
              className="grid gap-x-4 gap-y-1.5 py-4 sm:grid-cols-[10rem_1fr]"
            >
              <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-start">
                <StatusChip level={b.level} label={b.label} />
                <p className="text-sm font-medium text-ink tabular-nums">{doublingRangeLabel(b)}</p>
              </div>
              <div>
                <p className="text-base leading-relaxed text-ink/80">{b.note}</p>
                {here && (
                  <p className="mt-1 text-sm font-medium text-ink">Where {firstName} is now</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {months != null && current && (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Current best estimate for {firstName}: about {months.toFixed(1)} months (
          {current.label.toLowerCase()}), fitted across all post-radiation PSA readings.
        </p>
      )}
    </>
  );
}
