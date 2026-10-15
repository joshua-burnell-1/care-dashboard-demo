// ABOUTME: Table of medications and supplements with per-row edit and an add button, both opening
// ABOUTME: the medication dialog.
import { Pencil } from "lucide-react";
import type { MedicationItem } from "@/hooks/useMedications";
import { Card } from "@/features/shared/SectionUi";

export function MedicationsCard({
  medications,
  onEdit,
}: {
  medications: MedicationItem[];
  /** Opens the medication dialog; `null` adds a new item. */
  onEdit: (item: MedicationItem | null) => void;
}) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-stone-500 border-b border-stone-200">
            <th className="text-left py-2 pr-2">Item</th>
            <th className="text-left py-2 pr-2">Dose</th>
            <th className="text-left py-2 pr-2">Purpose</th>
            <th className="text-left py-2">Started by</th>
            <th className="py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {medications.map((m) => (
            <tr key={m.id} className="border-b border-stone-100 last:border-0">
              <td className="py-2 pr-2 font-medium text-stone-900">{m.item}</td>
              <td className="py-2 pr-2 text-stone-600">{m.dose}</td>
              <td className="py-2 pr-2 text-stone-600">{m.purpose}</td>
              <td className="py-2 text-stone-500 text-xs">{m.started_by}</td>
              <td className="py-2">
                <button
                  onClick={() => onEdit(m)}
                  className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                  aria-label={`Edit ${m.item}`}
                >
                  <Pencil size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 pt-3 border-t border-stone-100">
        <button
          onClick={() => onEdit(null)}
          className="text-sm text-stone-600 hover:text-stone-900 transition"
        >
          + Add medication / supplement
        </button>
      </div>
    </Card>
  );
}
