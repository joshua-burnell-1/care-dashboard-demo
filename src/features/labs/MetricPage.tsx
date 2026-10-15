// ABOUTME: /labs/$metric: one lab metric with its latest value and status chip, a time-scaled
// ABOUTME: history chart with the reference range as a band, and every reading in a table.
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { openAssistant } from "@/components/assistant/assistantStore";
import { MetricChart } from "@/components/charts/MetricChart";
import { MascotLoader } from "@/components/MascotLoader";
import { NotFoundState } from "@/components/shell/NotFoundState";
import { Page } from "@/components/shell/Page";
import { StatusChip } from "@/components/StatusChip";
import { formatDate } from "@/lib/format";
import { formatLabValue, groupLabs, labStatus, parseReferenceRange } from "@/lib/labs";
import { useLabs } from "./useLabs";

export function MetricPage({ slug }: { slug: string }) {
  const { labs, loading } = useLabs();
  const metric = useMemo(
    () =>
      groupLabs(labs)
        .flatMap((g) => g.metrics)
        .find((m) => m.slug === slug),
    [labs, slug],
  );

  if (loading) return <MascotLoader label="Loading lab result…" />;
  if (!metric) {
    return (
      <NotFoundState
        title="Lab result not found"
        body="There is no lab result by that name in the record."
        backTo="/labs"
        backLabel="Back to Labs"
      />
    );
  }

  const { latest, name, readings, series } = metric;
  const unit = latest.unit?.trim();
  const value = formatLabValue(latest.value);
  const status = labStatus(latest);
  const range = parseReferenceRange(latest.reference_range);
  const count = readings.length;

  return (
    <Page
      wide
      title={name}
      breadcrumbs={[{ label: "Labs", to: "/labs" }, { label: name }]}
      description={`${count} reading${count === 1 ? "" : "s"}`}
      actions={
        <button
          type="button"
          onClick={() =>
            openAssistant({
              label: `${name} result`,
              prompt: `What does my latest ${name} result of ${value}${unit ? ` ${unit}` : ""} mean?`,
            })
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Sparkles size={14} aria-hidden />
          Ask about this
        </button>
      }
    >
      <div className="space-y-6">
        <section
          aria-label="Latest result"
          className="rounded-[20px] border border-line bg-surface p-5 sm:p-6"
        >
          <p className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            Latest result
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
            <p className="font-display text-6xl leading-none text-ink tabular-nums sm:text-7xl">
              {value}
              {unit && (
                <>
                  {" "}
                  <span className="ml-1 font-sans text-base text-muted">{unit}</span>
                </>
              )}
            </p>
            <StatusChip level={status.level} label={status.label} size="md" />
          </div>
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted">Drawn</dt>
              <dd className="text-ink tabular-nums">
                {latest.date ? formatDate(latest.date, "long") : "No date"}
              </dd>
            </div>
            {latest.reference_range && (
              <div>
                <dt className="text-xs text-muted">Reference range</dt>
                <dd className="text-ink tabular-nums">
                  {latest.reference_range}
                  {unit ? ` ${unit}` : ""}
                </dd>
              </div>
            )}
            {latest.source && (
              <div className="min-w-0">
                <dt className="text-xs text-muted">Source</dt>
                <dd className="text-ink">{latest.source}</dd>
              </div>
            )}
          </dl>
          {latest.note && <p className="mt-4 max-w-2xl text-sm text-muted">{latest.note}</p>}
        </section>

        <section
          aria-labelledby="history-heading"
          className="rounded-[20px] border border-line bg-surface p-5 sm:p-6"
        >
          <h2 id="history-heading" className="font-display text-2xl text-ink">
            History
          </h2>
          <p className="mt-1 text-sm text-muted">
            {range
              ? "Readings by date. The shaded band is the reference range."
              : "Readings by date."}
          </p>
          <div className="mt-5">
            <MetricChart name={name} series={series} unit={unit} range={range} />
          </div>
        </section>

        <section
          aria-labelledby="readings-heading"
          className="rounded-[20px] border border-line bg-surface"
        >
          <h2
            id="readings-heading"
            className="rounded-t-[20px] border-b border-line px-5 py-4 font-display text-2xl text-ink"
          >
            Readings
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs tracking-[0.08em] text-muted uppercase">
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Date
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Result
                </th>
                <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">
                  Reference
                </th>
                <th scope="col" className="hidden px-5 py-2.5 font-medium sm:table-cell">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {readings.map((r, i) => {
                const rowStatus = labStatus(r);
                const flagged = rowStatus.level === "watch";
                return (
                  <tr key={`${r.date ?? "undated"}-${i}`} className="align-top">
                    <td className="px-5 py-3 whitespace-nowrap text-muted tabular-nums">
                      {r.date ? formatDate(r.date) : "No date"}
                      {r.source && (
                        <span className="mt-0.5 block max-w-[10rem] truncate text-xs sm:hidden">
                          {r.source}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium text-ink tabular-nums">
                          {formatLabValue(r.value)}
                          {r.unit ? ` ${r.unit}` : ""}
                        </span>
                        {flagged && <StatusChip level={rowStatus.level} label={rowStatus.label} />}
                      </span>
                      {r.note && <p className="mt-1 max-w-md text-xs text-muted">{r.note}</p>}
                    </td>
                    <td className="hidden px-3 py-3 text-muted tabular-nums sm:table-cell">
                      {r.reference_range ?? ""}
                    </td>
                    <td className="hidden px-5 py-3 text-muted sm:table-cell">{r.source ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </Page>
  );
}
