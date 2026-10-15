import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyPsaReadingsChanged } from "@/hooks/usePsaReadings";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, Circle, X, Loader2 } from "lucide-react";

export interface SuggestedPsa {
  date: string;
  value: number | null;
  unit: string;
  phase: string;
  note: string;
}
export interface SuggestedMed {
  item: string;
  dose?: string;
  purpose?: string;
  started_by?: string;
}
export interface SuggestedTeam {
  name: string;
  role?: string;
  where_based?: string;
  note?: string;
}
export interface SuggestedPlan {
  title: string;
  body?: string;
  event_date?: string | null;
  status?: string;
}
export interface SuggestedLab {
  date?: string | null;
  metric: string;
  category?: string;
  value?: number | string | null;
  unit?: string;
  reference_range?: string;
  flag?: string | null;
  note?: string;
}
export interface SuggestedUpdates {
  psa_readings?: SuggestedPsa[];
  medications?: SuggestedMed[];
  care_team?: SuggestedTeam[];
  plan_items?: SuggestedPlan[];
  lab_results?: SuggestedLab[];
}

function hasAny(s: SuggestedUpdates): boolean {
  return (
    (s.psa_readings?.length ?? 0) +
      (s.medications?.length ?? 0) +
      (s.care_team?.length ?? 0) +
      (s.plan_items?.length ?? 0) +
      (s.lab_results?.length ?? 0) >
    0
  );
}

function flagChipClass(flag?: string | null): string {
  const f = (flag ?? "").toUpperCase();
  if (f === "NORMAL") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (f === "HIGH" || f === "LOW" || f === "ABNORMAL")
    return "bg-amber-50 text-amber-700 border-amber-200";
  return "";
}

function Row({
  label,
  checked,
  onToggle,
  children,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition ${
        checked ? "border-teal-200 bg-teal-50/60" : "border-stone-200 bg-stone-50/40 opacity-60"
      }`}
    >
      <span className="mt-0.5 shrink-0 text-teal-600">
        {checked ? <CheckCircle2 size={16} /> : <Circle size={16} className="text-stone-400" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <div className="text-sm text-stone-800">{children}</div>
      </div>
    </button>
  );
}

interface Props {
  open: boolean;
  filename: string;
  documentId: string | null;
  suggestions: SuggestedUpdates;
  password: string;
  onClose: () => void;
  onApplied: () => void;
}

export function SuggestionsModal({
  open,
  filename,
  documentId,
  suggestions,
  password,
  onClose,
  onApplied,
}: Props) {
  const [psaSel, setPsaSel] = useState<boolean[]>(() =>
    (suggestions.psa_readings ?? []).map(() => true),
  );
  const [medSel, setMedSel] = useState<boolean[]>(() =>
    (suggestions.medications ?? []).map(() => true),
  );
  const [teamSel, setTeamSel] = useState<boolean[]>(() =>
    (suggestions.care_team ?? []).map(() => true),
  );
  const [planSel, setPlanSel] = useState<boolean[]>(() =>
    (suggestions.plan_items ?? []).map(() => true),
  );
  const [labSel, setLabSel] = useState<boolean[]>(() =>
    (suggestions.lab_results ?? []).map(() => true),
  );
  const [applying, setApplying] = useState(false);

  if (!open || !hasAny(suggestions)) return null;

  const total = [psaSel, medSel, teamSel, planSel, labSel].flat().filter(Boolean).length;

  async function apply() {
    setApplying(true);
    let applied = 0;
    const skipped: string[] = [];

    async function tryUpsert(label: string, fn: () => Promise<{ data: unknown; error: unknown }>) {
      const { data, error } = await fn();
      const d = data as { ok: boolean; error?: string } | null;
      if (error || !d?.ok) {
        const e = error as { context?: { error?: string }; message?: string } | null;
        const msg = d?.error ?? e?.context?.error ?? e?.message ?? "failed";
        skipped.push(`${label}: ${msg}`);
      } else {
        applied++;
      }
    }

    const psa = suggestions.psa_readings ?? [];
    const appliedBeforePsa = applied;
    for (let i = 0; i < psa.length; i++) {
      if (!psaSel[i]) continue;
      await tryUpsert(`PSA ${psa[i].date}`, () =>
        supabase.functions.invoke("dashboard-data", {
          body: { action: "upsert-psa", password, item: psa[i] },
        }),
      );
    }
    // Tell every mounted PSA view to refetch (realtime alone may not reach them).
    if (applied > appliedBeforePsa) notifyPsaReadingsChanged();
    const meds = suggestions.medications ?? [];
    for (let i = 0; i < meds.length; i++) {
      if (!medSel[i]) continue;
      await tryUpsert(meds[i].item, () =>
        supabase.functions.invoke("dashboard-data", {
          body: { action: "upsert-medication", password, item: meds[i] },
        }),
      );
    }
    const team = suggestions.care_team ?? [];
    for (let i = 0; i < team.length; i++) {
      if (!teamSel[i]) continue;
      await tryUpsert(team[i].name, () =>
        supabase.functions.invoke("dashboard-data", {
          body: { action: "upsert-care-team", password, item: team[i] },
        }),
      );
    }
    const plan = suggestions.plan_items ?? [];
    for (let i = 0; i < plan.length; i++) {
      if (!planSel[i]) continue;
      await tryUpsert(plan[i].title, () =>
        supabase.functions.invoke("plan-items", {
          body: { action: "upsert", password, item: plan[i] },
        }),
      );
    }
    const labs = suggestions.lab_results ?? [];
    for (let i = 0; i < labs.length; i++) {
      if (!labSel[i]) continue;
      const lab = labs[i];
      await tryUpsert(lab.metric, () =>
        supabase.functions.invoke("dashboard-data", {
          body: {
            action: "upsert-lab-result",
            password,
            item: {
              date: lab.date ?? null,
              metric: lab.metric,
              category: lab.category ?? null,
              value: lab.value ?? null,
              unit: lab.unit ?? "",
              reference_range: lab.reference_range ?? null,
              flag: lab.flag ?? null,
              note: lab.note ?? "",
              source: "upload",
              source_document_id: documentId,
            },
          },
        }),
      );
    }

    setApplying(false);
    if (applied > 0) {
      toast.success(`Applied ${applied} update${applied === 1 ? "" : "s"} from "${filename}"`);
    }
    if (skipped.length > 0) {
      const preview =
        skipped.slice(0, 2).join("; ") + (skipped.length > 2 ? ` +${skipped.length - 2} more` : "");
      toast.warning(`${skipped.length} item${skipped.length === 1 ? "" : "s"} skipped`, {
        description: preview,
      });
    }
    if (applied > 0) onApplied();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-stone-100">
          <div className="h-9 w-9 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-teal-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-stone-900 text-sm">Suggested updates found</h3>
            <p className="text-xs text-stone-500 mt-0.5 truncate">
              From "{filename}" — review and apply
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>

        {/* Suggestions list */}
        <div className="p-4 space-y-2.5 max-h-[50vh] overflow-y-auto">
          {(suggestions.psa_readings ?? []).map((r, i) => (
            <Row
              key={`psa-${i}`}
              label="PSA reading"
              checked={psaSel[i]}
              onToggle={() => setPsaSel((s) => s.map((v, j) => (j === i ? !v : v)))}
            >
              <span className="font-semibold">
                {r.value != null ? `${r.value} ${r.unit}` : "Scheduled"}
              </span>
              <span className="text-stone-500">
                {" "}
                · {r.date} · {r.phase}
              </span>
              {r.note && <span className="text-stone-500"> · {r.note}</span>}
            </Row>
          ))}
          {(suggestions.medications ?? []).map((m, i) => (
            <Row
              key={`med-${i}`}
              label="Medication"
              checked={medSel[i]}
              onToggle={() => setMedSel((s) => s.map((v, j) => (j === i ? !v : v)))}
            >
              <span className="font-semibold">{m.item}</span>
              {m.dose && <span className="text-stone-500"> · {m.dose}</span>}
              {m.purpose && <span className="text-stone-500"> — {m.purpose}</span>}
            </Row>
          ))}
          {(suggestions.care_team ?? []).map((t, i) => (
            <Row
              key={`team-${i}`}
              label="Care team"
              checked={teamSel[i]}
              onToggle={() => setTeamSel((s) => s.map((v, j) => (j === i ? !v : v)))}
            >
              <span className="font-semibold">{t.name}</span>
              {t.role && <span className="text-stone-500"> · {t.role}</span>}
              {t.where_based && <span className="text-stone-500"> · {t.where_based}</span>}
            </Row>
          ))}
          {(suggestions.plan_items ?? []).map((p, i) => (
            <Row
              key={`plan-${i}`}
              label="Plan item"
              checked={planSel[i]}
              onToggle={() => setPlanSel((s) => s.map((v, j) => (j === i ? !v : v)))}
            >
              <span className="font-semibold">{p.title}</span>
              {p.event_date && <span className="text-stone-500"> · {p.event_date}</span>}
              {p.body && <p className="text-stone-600 text-xs mt-0.5">{p.body}</p>}
            </Row>
          ))}
          {(suggestions.lab_results ?? []).map((r, i) => (
            <Row
              key={`lab-${i}`}
              label="Lab result"
              checked={labSel[i]}
              onToggle={() => setLabSel((s) => s.map((v, j) => (j === i ? !v : v)))}
            >
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="font-semibold">{r.metric}</span>
                {r.value !== null && r.value !== undefined && r.value !== "" && (
                  <span className="text-stone-800">{`${r.value}${r.unit ? " " + r.unit : ""}`}</span>
                )}
                {r.reference_range && (
                  <span className="text-stone-500 text-xs">· ref {r.reference_range}</span>
                )}
                {r.flag && (
                  <span
                    className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${flagChipClass(r.flag)}`}
                  >
                    {r.flag}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 mt-0.5 text-xs">
                {r.date ? (
                  <span className="text-stone-500">{r.date}</span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                    no date
                  </span>
                )}
                {r.category && <span className="text-stone-500">· {r.category}</span>}
                {r.note && <span className="text-stone-500">· {r.note}</span>}
              </div>
            </Row>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-stone-100 bg-stone-50/50">
          <button
            onClick={onClose}
            className="text-sm text-stone-500 hover:text-stone-800 transition px-3 py-2"
          >
            Skip
          </button>
          <button
            onClick={apply}
            disabled={applying || total === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition disabled:opacity-50"
          >
            {applying && <Loader2 size={14} className="animate-spin" />}
            Apply {total} update{total === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
