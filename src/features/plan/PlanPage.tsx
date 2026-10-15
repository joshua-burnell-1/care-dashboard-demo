// ABOUTME: The /plan content until Task 6: overdue, upcoming and ongoing plan items, the archive of
// ABOUTME: completed ones, and the decision tree, with the plan-item and visit-prep dialogs.
import { useMemo, useState } from "react";
import { MascotLoader } from "@/components/MascotLoader";
import { PlanItemDialog } from "@/components/dashboard/PlanItemDialog";
import { VisitPrepDialog } from "@/components/dashboard/VisitPrepDialog";
import { Page } from "@/components/shell/Page";
import { useMedications } from "@/hooks/useMedications";
import { usePlanItems, savePlanItem, deletePlanItem, type PlanItem } from "@/hooks/usePlanItems";
import { usePsaReadings } from "@/hooks/usePsaReadings";
import { demoDb } from "@/integrations/supabase/client";
import { isoDaysFromToday } from "@/demo/dates";
import { useAppSession } from "@/lib/appSession";
import { Card, H2 } from "@/features/shared/SectionUi";
import { useSections } from "@/features/shared/sections";
import { PlanRow } from "./PlanRow";

const SECTION_KEYS = ["decision_tree"];

export function PlanPage() {
  const { password } = useAppSession();
  const { items: planItems, loading, refresh } = usePlanItems();
  const { items: psaReadings } = usePsaReadings();
  const { items: medications } = useMedications();
  const { sec } = useSections(SECTION_KEYS);
  const decisionTree = sec<{ q: string; a: string }[]>("decision_tree", []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlanItem | null>(null);
  // Demo only: the plan item a visit-prep brief is open for.
  const [prepItem, setPrepItem] = useState<PlanItem | null>(null);

  // Local calendar day, the same helper the seed uses, so plan dates compare correctly.
  const today = useMemo(() => isoDaysFromToday(0), []);

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

  function openEditor(item: PlanItem | null) {
    setEditing(item);
    setDialogOpen(true);
  }

  const row = (it: PlanItem, showDate: boolean, canPrep = false) => (
    <PlanRow
      key={it.id}
      item={it}
      overdue={isOverdue(it)}
      showDate={showDate}
      canPrep={canPrep}
      onEdit={openEditor}
      onPrep={setPrepItem}
    />
  );

  return (
    <Page title="Plan">
      <section className="space-y-4">
        <H2>What needs to happen next</H2>
        {loading ? (
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
                        {overdueDated.map((it) => row(it, true))}
                      </ol>
                    </div>
                  )}
                  {upcomingDated.length > 0 && (
                    <ol className="border-l-2 border-stone-200 ml-2 space-y-5">
                      {upcomingDated.map((it) => row(it, true, true))}
                    </ol>
                  )}
                  {undatedItems.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-stone-200">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-3">
                        Ongoing & on hold
                      </p>
                      <ol className="border-l-2 border-stone-200 ml-2 space-y-5">
                        {undatedItems.map((it) => row(it, false))}
                      </ol>
                    </div>
                  )}
                </>
              )}
              <div className="mt-5 pt-4 border-t border-stone-100 flex justify-end">
                <button
                  onClick={() => openEditor(null)}
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
                    {completedItems.map((it) => row(it, !!it.event_date))}
                  </ol>
                </Card>
              </details>
            )}
          </>
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

      <PlanItemDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSave={async (item) => {
          await savePlanItem(password, item);
          await refresh();
        }}
        onDelete={async (id) => {
          await deletePlanItem(password, id);
          await refresh();
        }}
      />
      {demoDb && (
        <VisitPrepDialog
          item={prepItem}
          context={visitPrepContext}
          onClose={() => setPrepItem(null)}
        />
      )}
    </Page>
  );
}
