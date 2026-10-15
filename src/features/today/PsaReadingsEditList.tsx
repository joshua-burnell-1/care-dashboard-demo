// ABOUTME: Edit mode's list of PSA readings under the Today chart: add a reading, or pick one to
// ABOUTME: edit in the shared PSA dialog. Task 8 replaces it with inline editing.
import { Pencil, Plus } from "lucide-react";
import type { PsaReading } from "@/hooks/usePsaReadings";
import { formatDate } from "@/lib/format";

export function PsaReadingsEditList({
  readings,
  onEdit,
}: {
  readings: PsaReading[];
  /** Opens the reading dialog; `null` adds a new reading. */
  onEdit: (reading: PsaReading | null) => void;
}) {
  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.12em] text-muted uppercase">Edit readings</p>
        <button
          type="button"
          onClick={() => onEdit(null)}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary"
        >
          <Plus size={14} aria-hidden />
          Add reading
        </button>
      </div>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {readings.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onEdit(r)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ink transition-colors duration-200 ease-out hover:bg-secondary"
            >
              <Pencil size={12} aria-hidden className="shrink-0 text-muted" />
              <span className="w-24 shrink-0 text-xs text-muted tabular-nums">
                {formatDate(r.date)}
              </span>
              <span className="tabular-nums">
                {r.value != null ? `${r.value} ${r.unit}` : "(scheduled)"}
              </span>
              {r.note && <span className="truncate text-xs text-muted">{r.note}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
