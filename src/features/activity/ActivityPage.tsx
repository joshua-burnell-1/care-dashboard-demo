// ABOUTME: The /activity log: every change in plain words, grouped by day under sticky headers, with
// ABOUTME: a filter by area and pages in the URL, and Undo per row through the history rollback.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDown, History, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { MascotLoader } from "@/components/MascotLoader";
import { Pagination } from "@/components/Pagination";
import { Page } from "@/components/shell/Page";
import { StatusChip } from "@/components/StatusChip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEditHistory, type EditHistoryEntry } from "@/hooks/useEditHistory";
import { notifyPsaReadingsChanged } from "@/hooks/usePsaReadings";
import { SAVE_ERROR_TOAST_ID, SAVE_TOAST_ID } from "@/hooks/useUndoableSave";
import { supabase } from "@/integrations/supabase/client";
import {
  ACTIVITY_FILTERS,
  describeEdit,
  filterForTable,
  groupByDay,
  undoStates,
  type EditDescription,
  type EntryUndo,
} from "@/lib/activity";
import { useAppSession } from "@/lib/appSession";
import { humanError, invokeErrorText } from "@/lib/humanError";
import { paginate } from "@/lib/labs";

const PAGE_SIZE = 20;
/** The demo keeps this many log rows; the page reads the same window. */
const HISTORY_WINDOW = 200;

const ICONS: Record<EditDescription["icon"], LucideIcon> = {
  add: Plus,
  edit: Pencil,
  delete: Trash2,
};

const control =
  "h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Why a row's Undo is held back, as a chip label. */
const BLOCKED: Partial<Record<EntryUndo["state"], string>> = {
  "changed-since": "Changed since",
  "removed-since": "Removed since",
};

function ActivityRow({
  entry,
  undo,
  busy,
  onUndo,
}: {
  entry: EditHistoryEntry;
  undo: EntryUndo;
  busy: boolean;
  onUndo: () => void;
}) {
  const { title, detail, icon } = describeEdit(entry);
  const Icon = ICONS[icon];
  const area = filterForTable(entry.table_name)?.label;
  const undone = undo.state === "undone";
  const blocked = BLOCKED[undo.state];
  const hintId = `undo-hint-${entry.id}`;
  return (
    <li
      data-activity-row={entry.id}
      data-undo={undo.state}
      className="flex items-start gap-3 px-4 py-3.5 sm:px-5"
    >
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-ink"
      >
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${undone ? "text-muted line-through" : "text-ink"}`}>
          {title}
        </p>
        {detail && <p className="mt-0.5 text-sm text-muted">{detail}</p>}
        <p className="mt-1 text-xs text-muted">
          {[area, undo.reverts ? "Undo of an earlier change" : null].filter(Boolean).join(" · ")}
          {blocked && (
            <>
              {area || undo.reverts ? " · " : ""}
              <span id={hintId}>Undo the newer change first</span>
            </>
          )}
        </p>
      </div>
      <div className="shrink-0 pt-0.5">
        {undone ? (
          <StatusChip level="neutral" label="Undone" />
        ) : blocked ? (
          <span aria-describedby={hintId} title="Undo the newer change first">
            <StatusChip level="neutral" label={blocked} />
          </span>
        ) : undo.state === "available" ? (
          <button
            type="button"
            onClick={onUndo}
            disabled={busy}
            aria-label={`Undo: ${title}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
          >
            <RotateCcw size={14} aria-hidden />
            Undo
          </button>
        ) : null}
      </div>
    </li>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-dashed border-line px-5 py-12 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-muted">
        <History size={22} aria-hidden />
      </span>
      <p className="mt-4 font-display text-2xl text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}

export function ActivityPage() {
  const { password } = useAppSession();
  const search = useSearch({ from: "/activity" });
  const navigate = useNavigate({ from: "/activity" });
  const { entries, loading, refresh } = useEditHistory(HISTORY_WINDOW);
  const [busy, setBusy] = useState<string | null>(null);
  // Undoing an addition deletes the row, so it asks first, as Delete does.
  const [confirming, setConfirming] = useState<EditHistoryEntry | null>(null);
  const undo = useMemo(() => undoStates(entries), [entries]);

  const table = search.table ?? "";
  const filter = ACTIVITY_FILTERS.find((f) => f.value === table);

  // An area the page does not know is dropped from the URL, replacing the history entry.
  useEffect(() => {
    if (table && !filter) {
      void navigate({
        search: (prev) => ({ ...prev, table: undefined, page: undefined }),
        replace: true,
        resetScroll: false,
      });
    }
  }, [table, filter, navigate]);

  // Only areas that have entries are offered, plus whatever the URL already asks for.
  const filters = useMemo(() => {
    const present = new Set(entries.map((e) => filterForTable(e.table_name)?.value));
    return ACTIVITY_FILTERS.filter((f) => present.has(f.value) || f.value === table);
  }, [entries, table]);

  const filtered = useMemo(
    () => (filter ? entries.filter((e) => filter.tables.includes(e.table_name)) : entries),
    [entries, filter],
  );
  const paged = useMemo(() => paginate(filtered, search.page ?? 1, PAGE_SIZE), [filtered, search]);
  const groups = useMemo(() => groupByDay(paged.items), [paged.items]);

  // A page past the end (or below 1) was clamped for display; make the URL say so.
  const requestedPage = search.page;
  useEffect(() => {
    if (loading || requestedPage === undefined || requestedPage === paged.page) return;
    void navigate({
      search: (prev) => ({ ...prev, page: paged.page === 1 ? undefined : paged.page }),
      replace: true,
      resetScroll: false,
    });
  }, [loading, requestedPage, paged.page, navigate]);

  function setTable(value: string) {
    void navigate({ search: { table: value || undefined, page: undefined }, resetScroll: false });
  }

  function requestUndo(entry: EditHistoryEntry) {
    if (entry.operation === "INSERT") setConfirming(entry);
    else void rollback(entry);
  }

  async function rollback(entry: EditHistoryEntry) {
    setBusy(entry.id);
    const { title } = describeEdit(entry);
    try {
      const { data, error } = await supabase.functions.invoke("dashboard-data", {
        body: { action: "rollback", password, history_id: entry.id },
      });
      if (error || !data?.ok) throw new Error(await invokeErrorText(data, error));
      if (entry.table_name === "psa_readings") notifyPsaReadingsChanged();
      // The rollback is itself a change; the fresh log marks this row undone and shows it.
      await refresh();
      toast.success("Undone", { id: SAVE_TOAST_ID, description: title });
    } catch (e) {
      toast.error("Could not undo", { id: SAVE_ERROR_TOAST_ID, description: humanError(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page
      title="Activity"
      description="Every change to the record, newest first. Undo puts a change back."
      wide
    >
      {loading ? (
        <MascotLoader label="Loading activity…" />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Nothing has changed yet"
          body="Edits to the plan, the care team, medications and PSA readings appear here, each with an Undo."
        />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-56">
              <select
                aria-label="Area"
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className={`${control} w-full appearance-none pr-9`}
              >
                <option value="">All areas</option>
                {filters.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
              />
            </div>
            <p role="status" className="text-sm text-muted tabular-nums">
              {filtered.length === 0
                ? "No changes"
                : `${filtered.length} ${filtered.length === 1 ? "change" : "changes"}`}
            </p>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={`No changes to ${filter?.label ?? "this area"} yet`}
              body="Pick another area, or show everything."
              action={
                <button
                  type="button"
                  onClick={() => setTable("")}
                  className="mt-5 inline-flex h-10 items-center rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Show all areas
                </button>
              }
            />
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <section
                  key={group.key}
                  aria-labelledby={`day-${group.key}`}
                  className="rounded-[20px] border border-line bg-surface"
                >
                  <h2
                    id={`day-${group.key}`}
                    className="sticky top-14 z-10 rounded-t-[20px] border-b border-line bg-surface/95 px-4 py-3 text-sm font-medium text-ink backdrop-blur-sm sm:px-5"
                  >
                    {group.label}
                  </h2>
                  <ul className="divide-y divide-line">
                    {group.entries.map((e) => (
                      <ActivityRow
                        key={e.id}
                        entry={e}
                        undo={undo.get(e.id) ?? { state: "unavailable", reverts: false }}
                        busy={busy !== null}
                        onUndo={() => requestUndo(e)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <Pagination
            page={paged.page}
            pages={paged.pages}
            onPageChange={(page) =>
              void navigate({
                search: (prev) => ({ ...prev, page: page === 1 ? undefined : page }),
              })
            }
          />
        </div>
      )}
      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent className="rounded-[20px] border-line bg-surface sm:rounded-[20px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal text-ink">
              Undo this addition?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted">
              {confirming ? `${describeEdit(confirming).title}. ` : ""}Undoing it removes it from
              the record. You can undo that too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              onClick={() => {
                if (confirming) void rollback(confirming);
                setConfirming(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
