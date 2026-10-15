// ABOUTME: The /plan page: the timeline of visits and tasks (overdue, upcoming, ongoing, past)
// ABOUTME: and the Decisions comparison. Rows edit in place with Undo; a dialog adds new items.
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { MascotLoader } from "@/components/MascotLoader";
import { PlanItemDialog } from "@/components/dashboard/PlanItemDialog";
import { Page } from "@/components/shell/Page";
import { usePlanItems, savePlanItem, deletePlanItem, type PlanItem } from "@/hooks/usePlanItems";
import { useUndoableSave } from "@/hooks/useUndoableSave";
import { isoDaysFromToday } from "@/demo/dates";
import { useAppSession } from "@/lib/appSession";
import { splitTimeline } from "@/lib/plan";
import { useSections } from "@/features/shared/sections";
import type { DoctorOpinion, TitledItem } from "@/features/shared/sections";
import { Decisions, type DecisionTreeItem } from "./Decisions";
import { Timeline } from "./Timeline";

const SECTION_KEYS = ["doctors", "agreements", "disagreements", "decision_tree"];

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-3 font-display text-3xl text-ink">
      {children}
    </h2>
  );
}

export function PlanPage() {
  const { password } = useAppSession();
  const { items, loading, refresh } = usePlanItems();
  const { sec } = useSections(SECTION_KEYS);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Saving the whole item back is also how an edit is undone.
  const write = async (item: PlanItem) => {
    const saved = await savePlanItem(password, item);
    await refresh();
    return saved;
  };
  const save = useUndoableSave(write, write);

  // Local calendar day, the same helper the seed uses, so plan dates compare correctly. Read on
  // every render (as the visit page does) so a page left open past midnight stays right.
  const today = isoDaysFromToday(0);
  const buckets = useMemo(() => splitTimeline(items, today), [items, today]);

  return (
    <Page
      title="Plan"
      description="What is coming up, and where the specialists agree and differ."
      wide
      actions={
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3.5 text-sm font-medium text-paper transition-colors duration-200 ease-out hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Plus size={16} aria-hidden />
          Add plan item
        </button>
      }
    >
      <div className="space-y-10">
        <section aria-labelledby="timeline-heading">
          <SectionHeading id="timeline-heading">Timeline</SectionHeading>
          {loading ? (
            <MascotLoader label="Loading plan…" />
          ) : (
            <Timeline
              buckets={buckets}
              today={today}
              onSave={save}
              onDelete={async (item) => {
                await deletePlanItem(password, item.id);
                await refresh();
              }}
            />
          )}
        </section>

        <section aria-labelledby="decisions-heading">
          <SectionHeading id="decisions-heading">Decisions</SectionHeading>
          <Decisions
            doctors={sec<DoctorOpinion[]>("doctors", [])}
            agreements={sec<string[]>("agreements", [])}
            disagreements={sec<TitledItem[]>("disagreements", [])}
            decisionTree={sec<DecisionTreeItem[]>("decision_tree", [])}
          />
        </section>
      </div>

      <PlanItemDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={async (item) => {
          await savePlanItem(password, item);
          await refresh();
        }}
      />
    </Page>
  );
}
