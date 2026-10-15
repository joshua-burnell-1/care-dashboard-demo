// ABOUTME: The home route's content until Task 4's Today page: hero, PSA trend, plain-language
// ABOUTME: summary, KPI cards and specialist opinions, with the PSA and KPI edit dialogs.
import { useMemo, useState } from "react";
import { MascotLoader } from "@/components/MascotLoader";
import { KpiCardDialog } from "@/components/dashboard/KpiCardDialog";
import { PsaReadingDialog } from "@/components/dashboard/PsaReadingDialog";
import { useMedicalCache } from "@/hooks/useMedicalCache";
import { usePlanItems } from "@/hooks/usePlanItems";
import {
  usePsaReadings,
  savePsaReading,
  deletePsaReading,
  type PsaReading,
} from "@/hooks/usePsaReadings";
import { useKpiCards, saveKpiCard, deleteKpiCard, type KpiCard } from "@/hooks/useKpiCards";
import { daysBetween, isoDaysFromToday } from "@/demo/dates";
import { useAppSession } from "@/lib/appSession";
import { formatDate } from "@/lib/format";
import { formatDoublingTime, psaDoublingMonths } from "@/lib/psaDoubling";
import {
  useSections,
  type DoctorOpinion,
  type PatientSection,
  type TitledItem,
} from "@/features/shared/sections";
import { KpiGrid } from "./KpiGrid";
import { OverviewHero } from "./OverviewHero";
import { PsaTrendCard } from "./PsaTrendCard";
import { SpecialistOpinions } from "./SpecialistOpinions";

const SECTION_KEYS = ["patient", "summary", "doctors", "agreements", "disagreements", "red_flags"];

export function OverviewPage() {
  const { password, editMode, setEditMode, openTour } = useAppSession();
  // The medical cache backs the labs and chat context; wait for it like the old dashboard did.
  const { loading: cacheLoading } = useMedicalCache();
  const { items: planItems } = usePlanItems();
  const { items: psaReadings, loading: psaLoading, refresh: refreshPsa } = usePsaReadings();
  const { items: kpis, loading: kpisLoading, refresh: refreshKpis } = useKpiCards();
  const { sections, sec } = useSections(SECTION_KEYS);
  const patient = sec<PatientSection>("patient", {});
  const summary = sec<string[]>("summary", []);

  const [psaDialogOpen, setPsaDialogOpen] = useState(false);
  const [psaEditing, setPsaEditing] = useState<PsaReading | null>(null);
  const [kpiDialogOpen, setKpiDialogOpen] = useState(false);
  const [kpiEditing, setKpiEditing] = useState<KpiCard | null>(null);

  const showLoader = cacheLoading || psaLoading || kpisLoading;
  // Local calendar day, the same helper the seed uses, so plan dates compare correctly.
  const today = useMemo(() => isoDaysFromToday(0), []);

  const latestPsa = useMemo(() => {
    const withValues = psaReadings.filter((r) => r.value !== null);
    return withValues.length > 0 ? withValues[withValues.length - 1] : null;
  }, [psaReadings]);

  // Dynamic first paragraph for "Reading this for the first time?": always reflects live PSA data
  const dynamicSummaryOpening = useMemo(() => {
    const withValues = psaReadings.filter((r) => r.value !== null);
    if (withValues.length === 0) return null;
    const monthYear = (iso: string) =>
      new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const readingList = withValues
      .slice(-5)
      .map((r) => `${r.value} (${formatDate(r.date, "long")})`)
      .join(", ");
    // Live section only (not a fallback); the sentence is skipped if a field is missing.
    const { first_name, surgery_date, radiation_end_date } = (sections.patient ??
      {}) as PatientSection;
    const history =
      first_name && surgery_date && radiation_end_date
        ? `For context, ${first_name}'s treatment so far is surgery (${monthYear(surgery_date)}) followed by a course of radiation, completed ${monthYear(radiation_end_date)}. `
        : "";
    return `${history}Most recent PSA results, oldest first: ${readingList}. Each value is small on its own; the care team looks at how the numbers move across several draws.`;
  }, [psaReadings, sections.patient]);

  // Doubling time fitted across every post-rad reading, so it agrees with the record's estimate
  const doublingTimeStr = useMemo(() => {
    const months = psaDoublingMonths(psaReadings.filter((r) => r.phase === "post-rad"));
    return months == null ? null : formatDoublingTime(months);
  }, [psaReadings]);

  // The soonest dated plan item that is not done, for the "Next appointment" card.
  const nextPlanItem = useMemo(
    () =>
      planItems
        .filter((i) => i.status !== "Completed" && i.event_date && i.event_date >= today)
        .sort((a, b) => a.event_date!.localeCompare(b.event_date!))[0] ?? null,
    [planItems, today],
  );

  // Override derived KPI cards with live computed values
  const derivedKpis = useMemo(
    () =>
      kpis.map((k) => {
        if (k.label === "Latest PSA" && latestPsa) {
          return {
            ...k,
            value: String(latestPsa.value ?? "—"),
            sub: `${formatDate(latestPsa.date)} · ng/mL`,
          };
        }
        if (k.label === "Scan ready?" && latestPsa?.value != null) {
          const v = latestPsa.value!;
          return {
            ...k,
            value: v >= 0.2 ? "Yes" : "Almost",
            sub: `${v} vs 0.20 readiness line`,
            tone: v >= 0.2 ? "rose" : "warn",
          };
        }
        if (k.label === "Doubling time" && doublingTimeStr) {
          return { ...k, value: doublingTimeStr };
        }
        if (k.label === "Next appointment") {
          if (!nextPlanItem?.event_date) return { ...k, value: "—", sub: "Nothing scheduled" };
          const days = daysBetween(today, nextPlanItem.event_date);
          const [y, m, d] = nextPlanItem.event_date.split("-").map(Number);
          return {
            ...k,
            value: new Date(y, m - 1, d).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
            sub: days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days away`,
          };
        }
        return k;
      }),
    [kpis, latestPsa, doublingTimeStr, nextPlanItem, today],
  );

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-5 sm:pt-6 pb-10 break-words">
      <OverviewHero
        patient={patient}
        latestPsa={psaLoading ? null : latestPsa}
        editMode={editMode}
        onToggleEdit={() => setEditMode((e) => !e)}
        onOpenTour={openTour}
      />

      {showLoader ? (
        <MascotLoader label="Loading records…" />
      ) : (
        <section className="space-y-4">
          <PsaTrendCard
            readings={psaReadings}
            editMode={editMode}
            onEdit={(r) => {
              setPsaEditing(r);
              setPsaDialogOpen(true);
            }}
          />

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-blue-900 mb-2">
              Reading this for the first time?
            </h2>
            {(dynamicSummaryOpening ? [dynamicSummaryOpening, ...summary.slice(1)] : summary).map(
              (s, i) => (
                <p key={i} className="text-sm text-blue-900/90 leading-relaxed mt-2 first:mt-0">
                  {s}
                </p>
              ),
            )}
          </div>

          <KpiGrid
            kpis={derivedKpis}
            editMode={editMode}
            onEdit={(k) => {
              setKpiEditing(k);
              setKpiDialogOpen(true);
            }}
          />

          <SpecialistOpinions
            doctors={sec<DoctorOpinion[]>("doctors", [])}
            agreements={sec<string[]>("agreements", [])}
            disagreements={sec<TitledItem[]>("disagreements", [])}
            redFlags={sec<TitledItem[]>("red_flags", [])}
          />
        </section>
      )}

      <PsaReadingDialog
        open={psaDialogOpen}
        initial={psaEditing}
        onClose={() => setPsaDialogOpen(false)}
        onSave={async (item) => {
          await savePsaReading(password, item);
          await refreshPsa();
        }}
        onDelete={async (id) => {
          await deletePsaReading(password, id);
          await refreshPsa();
        }}
      />
      <KpiCardDialog
        open={kpiDialogOpen}
        initial={kpiEditing}
        onClose={() => setKpiDialogOpen(false)}
        onSave={async (item) => {
          await saveKpiCard(password, item);
          await refreshKpis();
        }}
        onDelete={async (id) => {
          await deleteKpiCard(password, id);
          await refreshKpis();
        }}
      />
    </div>
  );
}
