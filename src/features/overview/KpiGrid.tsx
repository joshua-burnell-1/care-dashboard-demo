// ABOUTME: The overview's KPI cards (latest PSA, scan readiness, doubling time, next appointment
// ABOUTME: and any custom ones), with edit and add buttons in Edit mode.
import { Pencil } from "lucide-react";
import type { KpiCard } from "@/hooks/useKpiCards";
import { toneClasses } from "@/features/shared/sections";

const kpiAccentBorder: Record<string, string> = {
  rose: "#e11d48",
  warn: "#d97706",
  info: "#2563eb",
  ok: "#059669",
  neutral: "#a8a29e",
  danger: "#e11d48",
};

export function KpiGrid({
  kpis,
  editMode,
  onEdit,
}: {
  kpis: KpiCard[];
  editMode: boolean;
  /** Opens the KPI dialog; `null` adds a new card. */
  onEdit: (kpi: KpiCard | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <div
          key={k.id}
          className="relative bg-white rounded-2xl p-4 border border-stone-200/80 overflow-hidden"
          style={{
            boxShadow: "var(--shadow-card)",
            borderLeft: `3px solid ${kpiAccentBorder[k.tone] ?? kpiAccentBorder.neutral}`,
          }}
        >
          {editMode && (
            <button
              onClick={() => onEdit(k)}
              className="absolute top-2.5 right-2.5 p-1 rounded-md text-stone-300 hover:text-stone-600 hover:bg-stone-100 transition"
              aria-label={`Edit ${k.label}`}
            >
              <Pencil size={11} />
            </button>
          )}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 leading-none">
            {k.label}
          </p>
          <p className={`text-3xl font-bold mt-2 tabular-nums leading-none ${toneClasses[k.tone]}`}>
            {k.value}
          </p>
          <p className="text-[11px] text-stone-400 mt-1.5 leading-snug">{k.sub}</p>
        </div>
      ))}
      {editMode && (
        <button
          onClick={() => onEdit(null)}
          className="rounded-2xl p-4 border border-dashed border-stone-300 text-stone-400 hover:text-stone-600 hover:border-stone-400 text-xs transition flex flex-col items-center justify-center gap-1.5"
        >
          <span className="text-lg leading-none">+</span>
          <span>Add KPI</span>
        </button>
      )}
    </div>
  );
}
