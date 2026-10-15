// ABOUTME: The overview's hero: patient name, diagnosis and status, the latest PSA, and the
// ABOUTME: Tour, Print, History and Edit actions. Task 4 replaces it with the Today page.
import { Link } from "@tanstack/react-router";
import { Check, Clock, HelpCircle, Pencil, Printer } from "lucide-react";
import { AppMark } from "@/components/AppMark";
import { formatDate } from "@/lib/format";
import type { PsaReading } from "@/hooks/usePsaReadings";
import type { PatientSection } from "@/features/shared/sections";

const actionClass =
  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-white/20 bg-white/10 text-white/65 hover:bg-white/18 hover:text-white transition";

export function OverviewHero({
  patient,
  latestPsa,
  editMode,
  onToggleEdit,
  onOpenTour,
}: {
  patient: PatientSection;
  latestPsa: PsaReading | null;
  editMode: boolean;
  onToggleEdit: () => void;
  onOpenTour: () => void;
}) {
  return (
    <header
      className="mb-6 rounded-3xl overflow-hidden relative"
      style={{ boxShadow: "var(--shadow-hero)" }}
    >
      {/* Dark gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.17 0.025 70) 0%, oklch(0.21 0.045 200) 55%, oklch(0.19 0.06 240) 100%)",
        }}
      />
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 15% 60%, oklch(0.38 0.09 75 / 0.30) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, oklch(0.38 0.11 200 / 0.22) 0%, transparent 50%)",
        }}
      />

      {/* Main row */}
      <div className="relative z-10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <AppMark className="h-14 w-14 sm:h-16 sm:w-16" />
          <div className="min-w-0 flex-1">
            <p className="text-white/40 text-[10px] font-medium uppercase tracking-widest">
              {patient.name ? `${patient.name} · Care Dashboard` : "Care Dashboard"}
            </p>
            <h1 className="text-lg sm:text-xl font-bold text-white mt-0.5 tracking-tight truncate">
              {patient.diagnosis}
            </h1>
            <p className="text-white/55 text-xs mt-1 leading-relaxed line-clamp-2">
              {patient.status}
            </p>
          </div>
        </div>

        {/* PSA hero stat */}
        {latestPsa && (
          <div className="sm:text-right shrink-0">
            <p className="text-white/35 text-[10px] font-medium uppercase tracking-widest">
              Latest PSA
            </p>
            <div className="flex items-baseline gap-1.5 sm:justify-end mt-0.5">
              <span className="text-4xl sm:text-5xl font-bold tabular-nums text-rose-300 leading-none">
                {latestPsa.value}
              </span>
              <span className="text-white/40 text-sm">ng/mL</span>
            </div>
            <p className="text-white/35 text-[11px] mt-1">{formatDate(latestPsa.date)}</p>
          </div>
        )}
      </div>

      {/* Action buttons row */}
      <div className="relative z-10 px-5 sm:px-6 pb-4 flex items-center justify-end gap-2 border-t border-white/10 pt-3">
        <button onClick={onOpenTour} className={actionClass} aria-label="Open tour">
          <HelpCircle size={13} />
          <span className="hidden sm:inline">Tour</span>
        </button>
        <button onClick={() => window.print()} className={actionClass} aria-label="Print summary">
          <Printer size={13} />
          <span className="hidden sm:inline">Print</span>
        </button>
        <Link to="/activity" className={actionClass} aria-label="Edit history">
          <Clock size={13} />
          <span className="hidden sm:inline">History</span>
        </Link>
        <button
          onClick={onToggleEdit}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
            editMode
              ? "bg-white text-stone-900 border-white shadow-sm"
              : "border-white/20 bg-white/10 text-white/65 hover:bg-white/18 hover:text-white"
          }`}
          aria-label={editMode ? "Exit edit mode" : "Enter edit mode"}
        >
          {editMode ? <Check size={13} /> : <Pencil size={13} />}
          {editMode ? "Done editing" : "Edit"}
        </button>
      </div>
    </header>
  );
}
