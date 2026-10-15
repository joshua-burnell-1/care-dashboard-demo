// ABOUTME: The review step after a document is read: each suggested update as a toggle, then Apply
// ABOUTME: writes the chosen ones (PSA writes tell every PSA view to refetch).
import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { StatusChip } from "@/components/StatusChip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { notifyPsaReadingsChanged } from "@/hooks/usePsaReadings";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { FLAG_LABELS, normalizeFlag } from "@/lib/labs";

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

/** A lab flag as a status chip: High, Low or Flagged to watch, Normal as in range. */
function FlagChip({ flag }: { flag?: string | null }) {
  const f = normalizeFlag(flag);
  if (f) return <StatusChip level="watch" label={FLAG_LABELS[f]} />;
  if ((flag ?? "").toUpperCase() === "NORMAL")
    return <StatusChip level="stable" label="In range" />;
  return null;
}

/** "Oct 6, 2026", or nothing for a missing or unreadable date. */
const day = (iso?: string | null) => (iso ? formatDate(iso) : "");

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
      aria-pressed={checked}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none ${
        checked ? "border-ink/25 bg-surface" : "border-line bg-paper text-muted"
      }`}
    >
      <span aria-hidden className={`mt-0.5 shrink-0 ${checked ? "text-ink" : "text-muted"}`}>
        {checked ? <CheckCircle2 size={16} /> : <Circle size={16} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-xs font-medium tracking-wider text-muted uppercase">{label}</p>
        <div className={`text-sm ${checked ? "text-ink" : "text-muted"}`}>{children}</div>
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

  if (!hasAny(suggestions)) return null;

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
      await tryUpsert(`PSA ${day(psa[i].date) || psa[i].date}`, () =>
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

  const sep = <span className="text-muted"> · </span>;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !applying && onClose()}>
      <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col gap-0 overflow-hidden rounded-[20px] border-line bg-surface p-0 sm:rounded-[20px]">
        <DialogHeader className="flex-row items-start gap-3 space-y-0 border-b border-line p-5 pr-12 text-left">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-ink"
          >
            <Sparkles size={16} />
          </span>
          <div className="min-w-0">
            <DialogTitle className="font-display text-2xl leading-tight font-normal text-ink">
              Suggested updates found
            </DialogTitle>
            <DialogDescription className="mt-0.5 truncate text-sm text-muted">
              From {filename}. Choose what to add to the record.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {(suggestions.psa_readings ?? []).map((r, i) => (
            <Row
              key={`psa-${i}`}
              label="PSA reading"
              checked={psaSel[i]}
              onToggle={() => setPsaSel((s) => s.map((v, j) => (j === i ? !v : v)))}
            >
              <span className="font-medium tabular-nums">
                {r.value != null ? `${r.value} ${r.unit}` : "Scheduled"}
              </span>
              {day(r.date) && (
                <>
                  {sep}
                  <span className="tabular-nums">{day(r.date)}</span>
                </>
              )}
              {r.note && (
                <>
                  {sep}
                  {r.note}
                </>
              )}
            </Row>
          ))}
          {(suggestions.medications ?? []).map((m, i) => (
            <Row
              key={`med-${i}`}
              label="Medication"
              checked={medSel[i]}
              onToggle={() => setMedSel((s) => s.map((v, j) => (j === i ? !v : v)))}
            >
              <span className="font-medium">{m.item}</span>
              {m.dose && (
                <>
                  {sep}
                  {m.dose}
                </>
              )}
              {m.purpose && <p className="mt-0.5 text-xs text-muted">{m.purpose}</p>}
            </Row>
          ))}
          {(suggestions.care_team ?? []).map((t, i) => (
            <Row
              key={`team-${i}`}
              label="Care team"
              checked={teamSel[i]}
              onToggle={() => setTeamSel((s) => s.map((v, j) => (j === i ? !v : v)))}
            >
              <span className="font-medium">{t.name}</span>
              {t.role && (
                <>
                  {sep}
                  {t.role}
                </>
              )}
              {t.where_based && <p className="mt-0.5 text-xs text-muted">{t.where_based}</p>}
            </Row>
          ))}
          {(suggestions.plan_items ?? []).map((p, i) => (
            <Row
              key={`plan-${i}`}
              label="Plan item"
              checked={planSel[i]}
              onToggle={() => setPlanSel((s) => s.map((v, j) => (j === i ? !v : v)))}
            >
              <span className="font-medium">{p.title}</span>
              {day(p.event_date) && (
                <>
                  {sep}
                  <span className="tabular-nums">{day(p.event_date)}</span>
                </>
              )}
              {p.body && <p className="mt-0.5 text-xs text-muted">{p.body}</p>}
            </Row>
          ))}
          {(suggestions.lab_results ?? []).map((r, i) => (
            <Row
              key={`lab-${i}`}
              label="Lab result"
              checked={labSel[i]}
              onToggle={() => setLabSel((s) => s.map((v, j) => (j === i ? !v : v)))}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{r.metric}</span>
                {r.value !== null && r.value !== undefined && r.value !== "" && (
                  <span className="tabular-nums">{`${r.value}${r.unit ? " " + r.unit : ""}`}</span>
                )}
                <FlagChip flag={r.flag} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                {day(r.date) ? (
                  <span className="tabular-nums">{day(r.date)}</span>
                ) : (
                  <StatusChip level="neutral" label="No date" />
                )}
                {r.reference_range && <span className="tabular-nums">Ref {r.reference_range}</span>}
                {r.category && <span>{r.category}</span>}
                {r.note && <span>{r.note}</span>}
              </div>
            </Row>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-muted transition-colors duration-200 ease-out hover:bg-secondary hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={applying || total === 0}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-paper transition-colors duration-200 ease-out hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
          >
            {applying && <Loader2 size={14} aria-hidden className="animate-spin" />}
            Apply {total} update{total === 1 ? "" : "s"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
