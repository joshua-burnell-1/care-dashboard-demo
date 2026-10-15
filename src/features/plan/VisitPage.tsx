// ABOUTME: The /plan/$visitId page: the visit's date, status and notes, the streaming AI prep
// ABOUTME: brief inline, an Ask the assistant button, or a not-found state for an unknown id.
import { useMemo, useState } from "react";
import { Pencil, Sparkles } from "lucide-react";
import { openAssistant } from "@/components/assistant/assistantStore";
import { MascotLoader } from "@/components/MascotLoader";
import { StatusChip } from "@/components/StatusChip";
import { PlanItemDialog } from "@/components/dashboard/PlanItemDialog";
import { NotFoundState } from "@/components/shell/NotFoundState";
import { Page } from "@/components/shell/Page";
import { isoDaysFromToday } from "@/demo/dates";
import { useMedications } from "@/hooks/useMedications";
import { usePlanItems, savePlanItem, deletePlanItem } from "@/hooks/usePlanItems";
import { usePsaReadings } from "@/hooks/usePsaReadings";
import { demoDb } from "@/integrations/supabase/client";
import { useAppSession } from "@/lib/appSession";
import { formatDate, formatRelative } from "@/lib/format";
import { isOverdue, planChip } from "@/lib/plan";
import { VisitPrepBrief } from "./VisitPrepBrief";

const BUTTON =
  "inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function VisitPage({ visitId }: { visitId: string }) {
  const { password } = useAppSession();
  const { items, loading, refresh } = usePlanItems();
  const { items: psaReadings } = usePsaReadings();
  const { items: medications } = useMedications();
  const [editorOpen, setEditorOpen] = useState(false);
  const item = items.find((i) => i.id === visitId);

  const visitPrepContext = useMemo(
    () => ({
      recentPsa: psaReadings.map((r) => ({ date: r.date, value: r.value })),
      medications: medications.map((m) => (m.dose ? `${m.item} ${m.dose}` : m.item)),
    }),
    [psaReadings, medications],
  );

  if (loading) return <MascotLoader label="Loading visit…" />;
  if (!item) {
    return (
      <NotFoundState
        title="Visit not found"
        body="That plan item doesn't exist. It may have been deleted."
        backTo="/plan"
        backLabel="Back to Plan"
      />
    );
  }

  const chip = planChip(item, isOverdue(item, isoDaysFromToday(0)));
  const showBrief = !!demoDb && item.status !== "Completed";

  return (
    <Page
      title={item.title}
      breadcrumbs={[{ label: "Plan", to: "/plan" }, { label: item.title }]}
      actions={
        <>
          <button type="button" onClick={() => setEditorOpen(true)} className={BUTTON}>
            <Pencil size={14} aria-hidden />
            Edit
          </button>
          <button
            type="button"
            data-assistant-ask
            onClick={() =>
              openAssistant({
                label: item.title,
                prompt: item.event_date
                  ? `What should we ask at "${item.title}" on ${formatDate(item.event_date, "long")}, and what should we bring?`
                  : `What should we know about "${item.title}"?`,
              })
            }
            className={BUTTON}
          >
            <Sparkles size={14} aria-hidden />
            Ask the assistant
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <section
          aria-label="Visit details"
          className="rounded-[20px] border border-line bg-surface p-5 sm:p-6"
        >
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Date</dt>
              <dd className="mt-1.5">
                {item.event_date ? (
                  <>
                    <p className="font-display text-3xl leading-tight text-ink tabular-nums">
                      {formatDate(item.event_date, "long")}
                    </p>
                    <p className="text-sm text-muted tabular-nums">
                      {capitalize(formatRelative(item.event_date))}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted">No date, an ongoing item.</p>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Status</dt>
              <dd className="mt-1.5">
                <StatusChip level={chip.level} label={chip.label} size="md" />
              </dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-line pt-5">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Notes</h2>
            {item.body ? (
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {item.body}
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-muted">No notes yet. Use Edit to add some.</p>
            )}
          </div>
        </section>

        {showBrief && <VisitPrepBrief key={item.id} item={item} context={visitPrepContext} />}
      </div>

      <PlanItemDialog
        open={editorOpen}
        initial={item}
        onClose={() => setEditorOpen(false)}
        onSave={async (next) => {
          await savePlanItem(password, next);
          await refresh();
        }}
        onDelete={async (id) => {
          await deletePlanItem(password, id);
          await refresh();
        }}
      />
    </Page>
  );
}
