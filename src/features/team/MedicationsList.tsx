// ABOUTME: The medications and supplements as a clean list: item, dose, purpose, who started it and
// ABOUTME: when it was added, with a quiet edit action per row and an empty state.
import { Pencil } from "lucide-react";
import type { MedicationItem } from "@/hooks/useMedications";
import { formatDate } from "@/lib/format";

const COLUMNS =
  "md:[grid-template-columns:minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_2.25rem]";

function Cell({
  label,
  className = "",
  hideLabel = false,
  children,
}: {
  label: string;
  hideLabel?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p
        className={`mb-0.5 text-xs font-medium text-muted md:sr-only ${hideLabel ? "sr-only" : ""}`}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

export function MedicationsList({
  medications,
  onEdit,
}: {
  medications: MedicationItem[];
  /** Opens the medication dialog for this item. */
  onEdit: (item: MedicationItem) => void;
}) {
  if (medications.length === 0) {
    return (
      <p className="rounded-[20px] border border-line bg-surface p-5 text-sm text-muted">
        No medications or supplements are recorded yet. Add one to keep the daily list in one place.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
      <div
        aria-hidden
        className={`hidden gap-4 border-b border-line px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted md:grid ${COLUMNS}`}
      >
        <span>Item</span>
        <span>Dose</span>
        <span>Purpose</span>
        <span>Started by</span>
      </div>
      <ul className="divide-y divide-line">
        {medications.map((m) => (
          <li
            key={m.id}
            data-medication={m.item}
            className={`relative grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 md:items-start md:gap-4 md:px-6 ${COLUMNS}`}
          >
            <div className="col-span-2 pr-9 md:col-span-1 md:pr-0">
              <Cell label="Item" hideLabel>
                <p className="font-medium text-ink">{m.item}</p>
              </Cell>
            </div>
            <Cell label="Dose">
              <p className="text-sm text-ink tabular-nums">{m.dose || "Not set"}</p>
            </Cell>
            <Cell label="Purpose" className="order-last col-span-2 md:order-none md:col-span-1">
              <p className="text-sm text-muted">{m.purpose}</p>
            </Cell>
            <Cell label="Started by">
              <p className="text-sm text-ink">{m.started_by || "Not recorded"}</p>
              <p className="text-xs text-muted tabular-nums">Added {formatDate(m.created_at)}</p>
            </Cell>
            <button
              type="button"
              onClick={() => onEdit(m)}
              aria-label={`Edit ${m.item}`}
              className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-xl text-muted transition-colors duration-200 ease-out hover:bg-secondary hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:top-3.5 md:right-4"
            >
              <Pencil size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
