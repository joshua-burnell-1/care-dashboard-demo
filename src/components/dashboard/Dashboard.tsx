import { useState, useMemo } from "react";
import {
  Pencil,
  Check,
  Clock,
  Printer,
  HelpCircle,
  LayoutDashboard,
  FlaskConical,
  Calendar,
  Users,
  Heart,
  BookOpen,
  FolderOpen,
  Sparkles,
} from "lucide-react";
import { EditHistoryPanel } from "./EditHistoryPanel";
import { PsaChart } from "./PsaChart";
import { RecordsPanel } from "./RecordsPanel";
import { LabsPanel } from "./LabsPanel";
import { useMedicalCache } from "@/hooks/useMedicalCache";
import { usePlanItems, savePlanItem, deletePlanItem, type PlanItem } from "@/hooks/usePlanItems";
import {
  usePsaReadings,
  savePsaReading,
  deletePsaReading,
  type PsaReading,
} from "@/hooks/usePsaReadings";
import {
  useCareTeam,
  saveCareTeamMember,
  deleteCareTeamMember,
  type CareTeamMember,
} from "@/hooks/useCareTeam";
import {
  useMedications,
  saveMedication,
  deleteMedication,
  type MedicationItem,
} from "@/hooks/useMedications";
import { useKpiCards, saveKpiCard, deleteKpiCard, type KpiCard } from "@/hooks/useKpiCards";
import { useAllDashboardSections } from "@/hooks/useDashboardSections";
import { PlanItemDialog } from "./PlanItemDialog";
import { PsaReadingDialog } from "./PsaReadingDialog";
import { CareTeamDialog } from "./CareTeamDialog";
import { MedicationDialog } from "./MedicationDialog";
import { KpiCardDialog } from "./KpiCardDialog";
import { VisitPrepDialog } from "./VisitPrepDialog";
import { AppMark } from "@/components/AppMark";
import { MascotLoader } from "@/components/MascotLoader";
import { formatDoublingTime, psaDoublingMonths } from "@/lib/psaDoubling";
import { resolvePatientFirstName } from "@/lib/patientName";
import { demoDb } from "@/integrations/supabase/client";
import { daysBetween, isoDaysFromToday } from "@/demo/dates";

type Tone = "rose" | "info" | "warn" | "neutral" | "ok" | "danger";

/** Shape of the `patient` dashboard section. Every field is optional until it loads. */
type PatientSection = {
  name?: string;
  first_name?: string;
  diagnosis?: string;
  status?: string;
  surgery_date?: string;
  radiation_end_date?: string;
};

type DoctorOpinion = {
  pillTone: "rose" | "info";
  pillLabel: string;
  name: string;
  meta: string;
  quote: string;
  rows: { k: string; v: string }[];
};
type TitledItem = { title: string; body: string };
type NutritionItem = { name: string; category?: "food" | "drink"; goal: string; why: string };
type AvoidItem = { name: string; category?: "food" | "drink"; body: string };

const SECTION_KEYS = [
  "patient",
  "summary",
  "doctors",
  "agreements",
  "disagreements",
  "red_flags",
  "decision_tree",
  "nutrition_foods",
  "nutrition_avoid",
  "pathology_features",
  "doubling_bands",
  "glossary",
];

const toneClasses: Record<string, string> = {
  rose: "text-rose-700",
  warn: "text-amber-700",
  info: "text-blue-800",
  ok: "text-emerald-700",
  neutral: "text-stone-600",
  danger: "text-rose-700",
};
const pillClasses: Record<string, string> = {
  rose: "bg-rose-100 text-rose-800",
  info: "bg-blue-100 text-blue-800",
  warn: "bg-amber-100 text-amber-800",
  neutral: "bg-stone-100 text-stone-700",
  ok: "bg-emerald-100 text-emerald-800",
};

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "labs", label: "Labs", icon: FlaskConical },
  { id: "plan", label: "Plan", icon: Calendar },
  { id: "team", label: "Care Team", icon: Users },
  { id: "daily", label: "Daily Care", icon: Heart },
  { id: "background", label: "Background", icon: BookOpen },
  { id: "records", label: "Records", icon: FolderOpen },
] as const;
type TabId = (typeof tabs)[number]["id"];

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-stone-200/80 rounded-2xl p-5 ${className}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </div>
  );
}
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-widest mt-8 mb-3 first:mt-0 flex items-center gap-2.5">
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-full border-2 border-stone-300 shrink-0"
      />
      {children}
    </h2>
  );
}

const kpiAccentBorder: Record<string, string> = {
  rose: "#e11d48",
  warn: "#d97706",
  info: "#2563eb",
  ok: "#059669",
  neutral: "#a8a29e",
  danger: "#e11d48",
};

export function Dashboard({
  password,
  onOpenTour,
  onTabChange,
}: {
  password: string;
  onOpenTour?: () => void;
  onTabChange?: (label: string) => void;
}) {
  const [tab, setTab] = useState<TabId>("overview");

  function switchTab(id: TabId) {
    setTab(id);
    const label = tabs.find((t) => t.id === id)?.label ?? id;
    onTabChange?.(label);
  }
  const [editMode, setEditMode] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // The medical cache backs the Labs panel and chat context
  const { loading: cacheLoading } = useMedicalCache();

  // Live data from Supabase
  const { items: planItems, loading: planLoading, refresh: refreshPlan } = usePlanItems();
  const { items: psaReadings, loading: psaLoading, refresh: refreshPsa } = usePsaReadings();
  const { items: careTeam, loading: teamLoading, refresh: refreshTeam } = useCareTeam();
  const { items: medications, loading: medsLoading, refresh: refreshMeds } = useMedications();
  const { items: kpis, loading: kpisLoading, refresh: refreshKpis } = useKpiCards();

  // Live dashboard sections. Until a section loads (or if it is missing) it renders empty:
  // there is no static fallback, so a real deployment never shows the demo's fictional content.
  const { sections } = useAllDashboardSections(SECTION_KEYS);
  const sec = <T,>(key: string, empty: T): T =>
    sections[key] != null ? (sections[key] as T) : empty;
  const patient = sec<PatientSection>("patient", {});
  // From the live section only, so a real deployment never shows the seed's fictional name.
  const firstName = resolvePatientFirstName(sections.patient, demoDb !== null);
  const summary = sec<string[]>("summary", []);
  const doctors = sec<DoctorOpinion[]>("doctors", []);
  const agreements = sec<string[]>("agreements", []);
  const disagreements = sec<TitledItem[]>("disagreements", []);
  const redFlags = sec<TitledItem[]>("red_flags", []);
  const decisionTree = sec<{ q: string; a: string }[]>("decision_tree", []);
  const nutritionFoods = sec<NutritionItem[]>("nutrition_foods", []);
  const nutritionAvoid = sec<AvoidItem[]>("nutrition_avoid", []);
  const pathologyFeatures = sec<TitledItem[]>("pathology_features", []);
  const doublingBands = sec<{ range: string; note: string; tone: Tone }[]>("doubling_bands", []);
  const glossary = sec<{ term: string; def: string }[]>("glossary", []);

  // Dialog state — plan
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planEditing, setPlanEditing] = useState<PlanItem | null>(null);
  // Demo only: the plan item a visit-prep brief is open for.
  const [prepItem, setPrepItem] = useState<PlanItem | null>(null);

  // Dialog state — PSA
  const [psaDialogOpen, setPsaDialogOpen] = useState(false);
  const [psaEditing, setPsaEditing] = useState<PsaReading | null>(null);

  // Dialog state — care team
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamEditing, setTeamEditing] = useState<CareTeamMember | null>(null);

  // Dialog state — medications
  const [medsDialogOpen, setMedsDialogOpen] = useState(false);
  const [medsEditing, setMedsEditing] = useState<MedicationItem | null>(null);

  // Dialog state — KPIs
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
    const d = (iso: string) =>
      new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    const monthYear = (iso: string) =>
      new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const recent = withValues.slice(-5);
    const readingList = recent.map((r) => `${r.value} (${d(r.date)})`).join(", ");
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
            sub: `${fmtDate(latestPsa.date)} · ng/mL`,
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

  const visitPrepContext = useMemo(
    () => ({
      recentPsa: psaReadings.map((r) => ({ date: r.date, value: r.value })),
      medications: medications.map((m) => (m.dose ? `${m.item} ${m.dose}` : m.item)),
    }),
    [psaReadings, medications],
  );

  function isOverdue(item: PlanItem): boolean {
    if (!item.event_date || item.event_date >= today) return false;
    if (item.status === "Completed") return false;
    return ["Scheduled", "In flight"].includes(item.status);
  }

  const completedItems = planItems.filter((i) => i.status === "Completed");
  const activeItems = planItems.filter((i) => i.status !== "Completed");
  const datedItems = activeItems.filter((i) => i.event_date);
  const overdueDated = datedItems.filter(isOverdue);
  const upcomingDated = datedItems.filter((i) => !isOverdue(i));
  const undatedItems = activeItems.filter((i) => !i.event_date);

  function fmtDate(d: string) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function pillToneFor(status: string): string {
    switch (status) {
      case "Locked":
        return "info";
      case "Scheduled":
        return "info";
      case "In flight":
        return "warn";
      case "Conditional":
        return "neutral";
      case "Hold":
        return "neutral";
      case "Daily":
        return "ok";
      case "Completed":
        return "ok";
      default:
        return "neutral";
    }
  }

  function PlanRow({
    item,
    showDate,
    canPrep = false,
  }: {
    item: PlanItem;
    showDate: boolean;
    canPrep?: boolean;
  }) {
    const overdue = isOverdue(item);
    const done = item.status === "Completed";
    const displayStatus = overdue ? "Overdue" : item.status;
    const displayTone = overdue ? "rose" : pillToneFor(item.status);
    return (
      <li className="relative pl-5">
        <span
          className={`absolute -left-[7px] top-3 w-3 h-3 rounded-full border-2 border-white ${
            done ? "bg-emerald-400" : overdue ? "bg-rose-400" : "bg-stone-300"
          }`}
        />
        <button
          type="button"
          onClick={() => {
            setPlanEditing(item);
            setPlanDialogOpen(true);
          }}
          className={`w-full text-left -mx-2 px-2 py-1.5 rounded-lg hover:bg-stone-50/80 transition cursor-pointer ${done ? "opacity-60" : ""}`}
          aria-label={`Edit ${item.title}`}
        >
          <div className="flex flex-wrap items-baseline gap-2">
            {showDate && item.event_date && (
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider tabular-nums ${overdue ? "text-rose-600" : "text-stone-500"}`}
              >
                {fmtDate(item.event_date)}
              </span>
            )}
            <p
              className={`font-semibold text-sm ${done ? "line-through text-stone-400" : "text-stone-900"}`}
            >
              {item.title}
            </p>
            {displayStatus && (
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${pillClasses[displayTone] ?? pillClasses.neutral}`}
              >
                {displayStatus}
              </span>
            )}
            <span
              aria-hidden
              className="ml-auto inline-flex items-center justify-center h-7 w-7 -my-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition"
            >
              <Pencil size={14} />
            </span>
          </div>
          {item.body && (
            <p
              className={`text-sm mt-1.5 leading-relaxed whitespace-pre-wrap ${done ? "text-stone-400" : "text-stone-600"}`}
            >
              {item.body}
            </p>
          )}
        </button>
        {canPrep && demoDb && (
          <button
            type="button"
            onClick={() => setPrepItem(item)}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            <Sparkles size={12} aria-hidden="true" />
            Prepare for this visit
          </button>
        )}
      </li>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-5 sm:pt-6 pb-10 break-words">
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
          {!psaLoading && latestPsa && (
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
              <p className="text-white/35 text-[11px] mt-1">
                {new Date(latestPsa.date + "T00:00:00").toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          )}
        </div>

        {/* Action buttons row */}
        <div className="relative z-10 px-5 sm:px-6 pb-4 flex items-center justify-end gap-2 border-t border-white/10 pt-3">
          {onOpenTour && (
            <button
              onClick={onOpenTour}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-white/20 bg-white/10 text-white/65 hover:bg-white/18 hover:text-white transition"
              aria-label="Open tour"
            >
              <HelpCircle size={13} />
              <span className="hidden sm:inline">Tour</span>
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-white/20 bg-white/10 text-white/65 hover:bg-white/18 hover:text-white transition"
            aria-label="Print summary"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-white/20 bg-white/10 text-white/65 hover:bg-white/18 hover:text-white transition"
            aria-label="Edit history"
          >
            <Clock size={13} />
            <span className="hidden sm:inline">History</span>
          </button>
          <button
            onClick={() => setEditMode((e) => !e)}
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

      <nav
        className="sticky top-2 z-30 bg-white/90 backdrop-blur-sm border border-stone-200/70 rounded-2xl p-1.5 flex gap-1 mb-6 overflow-x-auto scrollbar-none"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`flex-1 min-w-[58px] px-2 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5 sm:justify-center ${
              tab === t.id
                ? "bg-stone-900 text-white shadow-sm"
                : "text-stone-400 hover:text-stone-700 hover:bg-stone-100/80"
            }`}
          >
            <t.icon size={13} className="shrink-0" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden text-[10px]">{t.label.split(" ")[0]}</span>
          </button>
        ))}
      </nav>

      {showLoader && <MascotLoader label="Loading records…" />}

      {!showLoader && tab === "overview" && (
        <section className="space-y-4">
          <H2>PSA trend</H2>
          <div className="flex items-center justify-between -mb-1">
            <span />
            {editMode && (
              <button
                onClick={() => {
                  setPsaEditing(null);
                  setPsaDialogOpen(true);
                }}
                className="text-xs px-2.5 py-1 bg-stone-900 text-white rounded-lg hover:bg-stone-800"
              >
                + Add reading
              </button>
            )}
          </div>
          <Card>
            <PsaChart dbPsa={psaReadings} />
            {editMode && psaReadings.length > 0 && (
              <div className="mt-4 pt-4 border-t border-stone-100">
                <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-2">
                  Edit readings
                </p>
                <div className="space-y-1">
                  {psaReadings.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setPsaEditing(r);
                        setPsaDialogOpen(true);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-stone-50 transition flex items-center gap-2 text-sm text-stone-700"
                    >
                      <Pencil size={12} className="text-stone-400 shrink-0" />
                      <span className="tabular-nums text-stone-500 text-xs w-24 shrink-0">
                        {r.date}
                      </span>
                      <span>{r.value != null ? `${r.value} ${r.unit}` : "(scheduled)"}</span>
                      {r.note && (
                        <span className="text-stone-400 text-xs truncate">— {r.note}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {derivedKpis.map((k) => (
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
                    onClick={() => {
                      setKpiEditing(k);
                      setKpiDialogOpen(true);
                    }}
                    className="absolute top-2.5 right-2.5 p-1 rounded-md text-stone-300 hover:text-stone-600 hover:bg-stone-100 transition"
                    aria-label={`Edit ${k.label}`}
                  >
                    <Pencil size={11} />
                  </button>
                )}
                <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 leading-none">
                  {k.label}
                </p>
                <p
                  className={`text-3xl font-bold mt-2 tabular-nums leading-none ${toneClasses[k.tone]}`}
                >
                  {k.value}
                </p>
                <p className="text-[11px] text-stone-400 mt-1.5 leading-snug">{k.sub}</p>
              </div>
            ))}
            {editMode && (
              <button
                onClick={() => {
                  setKpiEditing(null);
                  setKpiDialogOpen(true);
                }}
                className="rounded-2xl p-4 border border-dashed border-stone-300 text-stone-400 hover:text-stone-600 hover:border-stone-400 text-xs transition flex flex-col items-center justify-center gap-1.5"
              >
                <span className="text-lg leading-none">+</span>
                <span>Add KPI</span>
              </button>
            )}
          </div>

          <H2>Latest specialist opinions</H2>
          <p className="text-sm text-stone-500 -mt-1 mb-2">
            Each specialist's most recent view, side by side. Where they agree and disagree is
            summarized below.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {doctors.map((d) => (
              <Card key={d.name}>
                <span
                  className={`inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full mb-2 ${pillClasses[d.pillTone]}`}
                >
                  {d.pillLabel}
                </span>
                <h3 className="font-semibold text-stone-900">{d.name}</h3>
                <p className="text-xs text-stone-500 mb-2">{d.meta}</p>
                <blockquote className="border-l-2 border-stone-200 pl-3 text-sm italic text-stone-600 my-2">
                  "{d.quote}"
                </blockquote>
                <div className="mt-3 divide-y divide-stone-100">
                  {d.rows.map((r) => (
                    <div key={r.k} className="py-2 text-xs">
                      <p className="uppercase tracking-wider text-[10px] text-stone-500 mb-0.5">
                        {r.k}
                      </p>
                      <p className="text-stone-700">{r.v}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <H2>Where they agree</H2>
          <Card>
            <ul className="space-y-2">
              {agreements.map((a, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-stone-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </Card>

          <H2>Where they disagree</H2>
          <Card>
            <ul className="space-y-3">
              {disagreements.map((d, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-stone-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                  <span>
                    <span className="font-semibold text-stone-900">{d.title}</span> {d.body}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <H2>Call a doctor if any of these red flags pop up</H2>
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5">
            <h3 className="font-semibold text-rose-800 mb-3">Same-day call for any of these</h3>
            <ul className="space-y-2.5">
              {redFlags.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-stone-700 break-words">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
                  <span>
                    <span className="font-semibold text-stone-900">{r.title}</span> — {r.body}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {!showLoader && tab === "labs" && (
        <section className="space-y-4">
          <H2>PSA readings</H2>
          <div
            className="bg-white border border-stone-200/80 rounded-2xl overflow-hidden"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-stone-700">PSA history</p>
              <p className="text-[11px] text-stone-400">
                {psaReadings.filter((r) => r.value !== null).length} readings
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-stone-400 border-b border-stone-100">
                    <th className="text-left px-5 py-2">Date</th>
                    <th className="text-left px-5 py-2">PSA (ng/mL)</th>
                    <th className="text-left px-5 py-2">Phase</th>
                    <th className="text-left px-5 py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {[...psaReadings].reverse().map((r) => (
                    <tr key={r.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-5 py-2.5 tabular-nums text-stone-600 text-xs">
                        {fmtDate(r.date)}
                      </td>
                      <td className="px-5 py-2.5 tabular-nums font-semibold text-stone-900">
                        {r.value != null ? (
                          r.value
                        ) : (
                          <span className="text-stone-400 font-normal">(scheduled)</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-stone-500 text-xs capitalize">
                        {r.phase.replace("-", " ")}
                      </td>
                      <td className="px-5 py-2.5 text-stone-500 text-xs">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <H2>All lab values from records</H2>
          <p className="text-sm text-stone-600 -mt-1">
            Every metric the AI could pull from uploaded documents — CBC, chemistry, and more.
          </p>
          <LabsPanel />
        </section>
      )}

      {!showLoader && tab === "plan" && (
        <section className="space-y-4">
          <H2>What needs to happen next</H2>
          {planLoading ? (
            <MascotLoader label="Loading plan…" />
          ) : (
            <>
              <Card>
                {datedItems.length === 0 && undatedItems.length === 0 ? (
                  <p className="text-sm text-stone-500">
                    No plan items yet. Add the first one below.
                  </p>
                ) : (
                  <>
                    {overdueDated.length > 0 && (
                      <div
                        className={
                          upcomingDated.length > 0 ? "mb-6 pb-5 border-b border-stone-200" : "mb-2"
                        }
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 mb-3">
                          Overdue
                        </p>
                        <ol className="border-l-2 border-rose-200 ml-2 space-y-5">
                          {overdueDated.map((it) => (
                            <PlanRow key={it.id} item={it} showDate />
                          ))}
                        </ol>
                      </div>
                    )}
                    {upcomingDated.length > 0 && (
                      <ol className="border-l-2 border-stone-200 ml-2 space-y-5">
                        {upcomingDated.map((it) => (
                          <PlanRow key={it.id} item={it} showDate canPrep />
                        ))}
                      </ol>
                    )}
                    {undatedItems.length > 0 && (
                      <div className="mt-6 pt-5 border-t border-stone-200">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-3">
                          Ongoing & on hold
                        </p>
                        <ol className="border-l-2 border-stone-200 ml-2 space-y-5">
                          {undatedItems.map((it) => (
                            <PlanRow key={it.id} item={it} showDate={false} />
                          ))}
                        </ol>
                      </div>
                    )}
                  </>
                )}
                <div className="mt-5 pt-4 border-t border-stone-100 flex justify-end">
                  <button
                    onClick={() => {
                      setPlanEditing(null);
                      setPlanDialogOpen(true);
                    }}
                    className="px-3 py-2 text-sm bg-stone-900 text-white rounded-lg hover:bg-stone-800"
                  >
                    + Add plan item
                  </button>
                </div>
              </Card>

              {completedItems.length > 0 && (
                <details className="group">
                  <summary className="flex items-center gap-2 cursor-pointer select-none list-none py-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 group-open:text-stone-600 transition">
                      Archived · {completedItems.length} completed
                    </span>
                    <span className="text-stone-300 text-xs group-open:rotate-90 transition-transform inline-block">
                      ▶
                    </span>
                  </summary>
                  <Card className="mt-3 opacity-80">
                    <ol className="border-l-2 border-stone-200 ml-2 space-y-5">
                      {completedItems.map((it) => (
                        <PlanRow key={it.id} item={it} showDate={!!it.event_date} />
                      ))}
                    </ol>
                  </Card>
                </details>
              )}
            </>
          )}

          <PlanItemDialog
            open={planDialogOpen}
            initial={planEditing}
            onClose={() => setPlanDialogOpen(false)}
            onSave={async (item) => {
              await savePlanItem(password, item);
              await refreshPlan();
            }}
            onDelete={async (id) => {
              await deletePlanItem(password, id);
              await refreshPlan();
            }}
          />

          {demoDb && (
            <VisitPrepDialog
              item={prepItem}
              context={visitPrepContext}
              onClose={() => setPrepItem(null)}
            />
          )}

          <H2>Decision tree</H2>
          <Card>
            <div className="space-y-3">
              {decisionTree.map((d, i) => (
                <div
                  key={i}
                  className="border-l-2 border-stone-200 pl-3 py-1.5 bg-stone-50/50 rounded-r"
                >
                  <p className="font-semibold text-sm text-stone-900">{d.q}</p>
                  <p className="text-sm text-stone-600 mt-1">{d.a}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {!showLoader && tab === "team" && (
        <section className="space-y-4">
          <H2>Care team</H2>
          {teamLoading ? (
            <MascotLoader label="Loading care team…" />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {careTeam.map((m) => (
                <Card key={m.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-stone-500">
                        {m.role}
                      </p>
                      <p className="font-semibold text-stone-900 mt-1">{m.name}</p>
                      <p className="text-sm text-stone-600">{m.where_based}</p>
                      <p className="text-xs text-stone-400 mt-1">{m.note}</p>
                    </div>
                    {editMode && (
                      <button
                        onClick={() => {
                          setTeamEditing(m);
                          setTeamDialogOpen(true);
                        }}
                        className="shrink-0 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                        aria-label={`Edit ${m.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                </Card>
              ))}
              {editMode && (
                <button
                  onClick={() => {
                    setTeamEditing(null);
                    setTeamDialogOpen(true);
                  }}
                  className="rounded-2xl p-5 border border-dashed border-stone-300 text-stone-400 hover:text-stone-600 hover:border-stone-400 text-sm transition flex items-center justify-center gap-1"
                >
                  + Add member
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {!showLoader &&
        tab === "daily" &&
        (() => {
          const isDrink = (f: { category?: string }) => f.category === "drink";
          const goodFood = nutritionFoods.filter((f) => !isDrink(f));
          const goodDrink = nutritionFoods.filter(isDrink);
          const avoidFood = nutritionAvoid.filter((f) => !isDrink(f));
          const avoidDrink = nutritionAvoid.filter(isDrink);
          return (
            <section className="space-y-4">
              <H2>Medications & supplements</H2>
              {medsLoading ? (
                <MascotLoader label="Loading medications…" />
              ) : (
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
                              onClick={() => {
                                setMedsEditing(m);
                                setMedsDialogOpen(true);
                              }}
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
                      onClick={() => {
                        setMedsEditing(null);
                        setMedsDialogOpen(true);
                      }}
                      className="text-sm text-stone-600 hover:text-stone-900 transition"
                    >
                      + Add medication / supplement
                    </button>
                  </div>
                </Card>
              )}

              <H2>Nutrition guide</H2>
              <div className="grid sm:grid-cols-2 gap-3">
                {/* Emphasize */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-3">
                    Emphasize
                  </p>

                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/60 mb-2">
                    Food
                  </p>
                  <ul className="space-y-3 mb-4">
                    {goodFood.map((f, i) => (
                      <li key={i} className="text-sm">
                        <p className="font-semibold text-emerald-900 leading-tight">
                          {f.name}{" "}
                          <span className="font-normal text-emerald-700/70">— {f.goal}</span>
                        </p>
                        <p className="text-emerald-800/60 text-xs mt-0.5 leading-relaxed">
                          {f.why}
                        </p>
                      </li>
                    ))}
                  </ul>

                  {goodDrink.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/60 mb-2 border-t border-emerald-200/60 pt-3">
                        Drinks
                      </p>
                      <ul className="space-y-3">
                        {goodDrink.map((f, i) => (
                          <li key={i} className="text-sm">
                            <p className="font-semibold text-emerald-900 leading-tight">
                              {f.name}{" "}
                              <span className="font-normal text-emerald-700/70">— {f.goal}</span>
                            </p>
                            <p className="text-emerald-800/60 text-xs mt-0.5 leading-relaxed">
                              {f.why}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>

                {/* Limit */}
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-3">
                    Limit or avoid
                  </p>

                  <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700/60 mb-2">
                    Food
                  </p>
                  <ul className="space-y-3 mb-4">
                    {avoidFood.map((f, i) => (
                      <li key={i} className="text-sm">
                        <p className="font-semibold text-rose-900 leading-tight">{f.name}</p>
                        <p className="text-rose-800/60 text-xs mt-0.5 leading-relaxed">{f.body}</p>
                      </li>
                    ))}
                  </ul>

                  {avoidDrink.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700/60 mb-2 border-t border-rose-200/60 pt-3">
                        Drinks
                      </p>
                      <ul className="space-y-3">
                        {avoidDrink.map((f, i) => (
                          <li key={i} className="text-sm">
                            <p className="font-semibold text-rose-900 leading-tight">{f.name}</p>
                            <p className="text-rose-800/60 text-xs mt-0.5 leading-relaxed">
                              {f.body}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </section>
          );
        })()}

      {!showLoader && tab === "background" && (
        <section className="space-y-4">
          <H2>What's special about {firstName}'s pathology</H2>
          <div className="space-y-2">
            {pathologyFeatures.map((p, i) => (
              <details key={i} className="bg-white border border-stone-200 rounded-xl group">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-stone-900 flex justify-between items-center gap-3">
                  <span>{p.title}</span>
                  <span className="text-stone-400 group-open:rotate-45 transition">+</span>
                </summary>
                <div className="px-4 pb-3 text-sm text-stone-600 leading-relaxed">{p.body}</div>
              </details>
            ))}
          </div>

          <H2>Doubling time — the number to watch</H2>
          <Card>
            <div className="divide-y divide-stone-100">
              {doublingBands.map((b) => (
                <div key={b.range} className="flex gap-4 py-2.5 text-sm">
                  <span className={`w-20 font-semibold shrink-0 ${toneClasses[b.tone]}`}>
                    {b.range}
                  </span>
                  <span className="text-stone-700">{b.note}</span>
                </div>
              ))}
            </div>
            {doublingTimeStr && (
              <p className="text-xs text-stone-500 mt-4 leading-relaxed">
                Current best estimate for {firstName}: {doublingTimeStr}, fitted across all
                post-radiation PSA readings.
              </p>
            )}
          </Card>

          <H2>Glossary</H2>
          <Card>
            <dl className="space-y-3 text-sm">
              {glossary.map((g) => (
                <div key={g.term}>
                  <dt className="font-semibold text-stone-900">{g.term}</dt>
                  <dd className="text-stone-600 mt-0.5">{g.def}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>
      )}

      {!showLoader && tab === "records" && (
        <section className="space-y-4">
          <RecordsPanel
            password={password}
            onApplied={() => {
              refreshPsa();
              refreshTeam();
              refreshMeds();
              refreshKpis();
              refreshPlan();
            }}
          />
        </section>
      )}

      <EditHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        password={password}
        onRestored={() => {
          refreshPsa();
          refreshTeam();
          refreshMeds();
          refreshKpis();
        }}
      />

      {/* Dialogs */}
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
      <CareTeamDialog
        open={teamDialogOpen}
        initial={teamEditing}
        onClose={() => setTeamDialogOpen(false)}
        onSave={async (item) => {
          await saveCareTeamMember(password, item);
          await refreshTeam();
        }}
        onDelete={async (id) => {
          await deleteCareTeamMember(password, id);
          await refreshTeam();
        }}
      />
      <MedicationDialog
        open={medsDialogOpen}
        initial={medsEditing}
        onClose={() => setMedsDialogOpen(false)}
        onSave={async (item) => {
          await saveMedication(password, item);
          await refreshMeds();
        }}
        onDelete={async (id) => {
          await deleteMedication(password, id);
          await refreshMeds();
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
