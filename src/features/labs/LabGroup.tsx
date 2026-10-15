// ABOUTME: One lab panel as a card: a sticky heading with the panel name and metric count, then
// ABOUTME: a row per metric. The heading stays under the top bar while the panel scrolls past.
import type { LabGroup as LabGroupData } from "@/lib/labs";
import { LabRow } from "./LabRow";

export function LabGroup({ group, id }: { group: LabGroupData; id: string }) {
  return (
    <section
      aria-labelledby={id}
      data-lab-group={group.panel}
      className="rounded-[20px] border border-line bg-surface"
    >
      <header className="sticky top-14 z-10 flex items-baseline justify-between gap-3 rounded-t-[20px] border-b border-line bg-surface/95 px-4 py-3 backdrop-blur-sm sm:px-5">
        <h2 id={id} className="min-w-0 font-display text-xl leading-tight text-ink">
          {group.panel}
        </h2>
        <span className="shrink-0 text-xs text-muted tabular-nums">
          {group.metrics.length} {group.metrics.length === 1 ? "result" : "results"}
        </span>
      </header>
      <ul className="divide-y divide-line">
        {group.metrics.map((metric) => (
          <LabRow key={metric.slug} metric={metric} />
        ))}
      </ul>
    </section>
  );
}
