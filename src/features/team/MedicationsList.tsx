// ABOUTME: The medications and supplements as a clean list: item, dose, purpose, and who started it,
// ABOUTME: each row edited in place from a quiet pencil, with an empty state.
import { InlineEdit, type InlineField } from "@/components/InlineEdit";
import type { MedicationItem } from "@/hooks/useMedications";

const COLUMNS =
  "md:[grid-template-columns:minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_2.25rem]";

const FIELDS: InlineField<MedicationItem>[] = [
  { name: "item", label: "Medication or supplement", required: true, maxLength: 300 },
  { name: "dose", label: "Dose", maxLength: 300, placeholder: "For example, 2,000 IU daily" },
  { name: "purpose", label: "Purpose", maxLength: 500 },
  { name: "started_by", label: "Started by", maxLength: 200 },
];

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
  onSave,
  onDelete,
}: {
  medications: MedicationItem[];
  /** Saves an edited row; `prev` is what it replaces, for Undo. */
  onSave: (next: MedicationItem, prev: MedicationItem) => Promise<void>;
  onDelete: (item: MedicationItem) => Promise<void>;
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
          <li key={m.id} data-medication={m.item}>
            <InlineEdit
              value={m}
              fields={FIELDS}
              subject={m.item}
              onSave={onSave}
              onDelete={() => onDelete(m)}
              className="px-5 py-4 md:px-6"
            >
              {(shown, pencil) => (
                <div
                  className={`relative grid grid-cols-2 gap-x-4 gap-y-3 md:items-start md:gap-4 ${COLUMNS}`}
                >
                  <div className="col-span-2 pr-9 md:col-span-1 md:pr-0">
                    <Cell label="Item" hideLabel>
                      <p className="font-medium text-ink">{shown.item}</p>
                    </Cell>
                  </div>
                  <Cell label="Dose">
                    <p className="text-sm text-ink tabular-nums">{shown.dose || "Not set"}</p>
                  </Cell>
                  <Cell
                    label="Purpose"
                    className="order-last col-span-2 md:order-none md:col-span-1"
                  >
                    <p className="text-sm text-muted">{shown.purpose}</p>
                  </Cell>
                  <Cell label="Started by">
                    <p className="text-sm text-ink">{shown.started_by || "Not recorded"}</p>
                  </Cell>
                  <div className="absolute -top-1 -right-2 md:static md:-mt-1.5">{pencil}</div>
                </div>
              )}
            </InlineEdit>
          </li>
        ))}
      </ul>
    </div>
  );
}
