// ABOUTME: Placeholder /labs/$metric page until Task 5: the metric's readings in a simple list, or
// ABOUTME: a not-found state when the record has no metric with that slug.
import { MascotLoader } from "@/components/MascotLoader";
import { NotFoundState } from "@/components/shell/NotFoundState";
import { Page } from "@/components/shell/Page";
import { formatDate } from "@/lib/format";
import { useLabMetrics } from "./useLabMetrics";

export function LabMetricPage({ slug }: { slug: string }) {
  const { metrics, loading } = useLabMetrics();
  const metric = metrics.find((m) => m.slug === slug);

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

  return (
    <Page
      title={metric.name}
      breadcrumbs={[{ label: "Labs", to: "/labs" }, { label: metric.name }]}
      description={`${metric.readings.length} reading${metric.readings.length === 1 ? "" : "s"}`}
    >
      <ul className="divide-y divide-line rounded-[20px] border border-line bg-surface">
        {metric.readings.map((r, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3 text-sm">
            <span className="w-28 shrink-0 text-muted tabular-nums">
              {r.date ? formatDate(r.date) : "No date"}
            </span>
            <span className="font-medium text-ink tabular-nums">
              {r.value ?? "None"}
              {r.unit ? ` ${r.unit}` : ""}
            </span>
            {r.flag && <span className="text-xs text-muted">{r.flag}</span>}
          </li>
        ))}
      </ul>
    </Page>
  );
}
