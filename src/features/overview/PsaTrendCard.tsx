// ABOUTME: The overview's PSA trend chart, with Add reading and a per-reading edit list shown in
// ABOUTME: Edit mode.
import { Pencil } from "lucide-react";
import { PsaChart } from "@/components/dashboard/PsaChart";
import type { PsaReading } from "@/hooks/usePsaReadings";
import { formatDate } from "@/lib/format";
import { Card, H2 } from "@/features/shared/SectionUi";

export function PsaTrendCard({
  readings,
  editMode,
  onEdit,
}: {
  readings: PsaReading[];
  editMode: boolean;
  /** Opens the reading dialog; `null` adds a new reading. */
  onEdit: (reading: PsaReading | null) => void;
}) {
  return (
    <>
      <H2>PSA trend</H2>
      <div className="flex items-center justify-between -mb-1">
        <span />
        {editMode && (
          <button
            onClick={() => onEdit(null)}
            className="text-xs px-2.5 py-1 bg-stone-900 text-white rounded-lg hover:bg-stone-800"
          >
            + Add reading
          </button>
        )}
      </div>
      <Card>
        <PsaChart dbPsa={readings} />
        {editMode && readings.length > 0 && (
          <div className="mt-4 pt-4 border-t border-stone-100">
            <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-2">
              Edit readings
            </p>
            <div className="space-y-1">
              {readings.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onEdit(r)}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-stone-50 transition flex items-center gap-2 text-sm text-stone-700"
                >
                  <Pencil size={12} className="text-stone-400 shrink-0" />
                  <span className="tabular-nums text-stone-500 text-xs w-24 shrink-0">
                    {formatDate(r.date)}
                  </span>
                  <span>{r.value != null ? `${r.value} ${r.unit}` : "(scheduled)"}</span>
                  {r.note && <span className="text-stone-400 text-xs truncate">— {r.note}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
