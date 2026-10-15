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
import { useEditHistory, type EditHistoryEntry } from "@/hooks/useEditHistory";
import { notifyPsaReadingsChanged } from "@/hooks/usePsaReadings";
import { SAVE_TOAST_ID } from "@/hooks/useUndoableSave";
import { supabase } from "@/integrations/supabase/client";
import {
  ACTIVITY_FILTERS,
  describeEdit,
  filterForTable,
  groupByDay,
  type EditDescription,
} from "@/lib/activity";
import { useAppSession } from "@/lib/appSession";
import { paginate } from "@/lib/labs";

const PAGE_SIZE = 20;
/** The demo keeps this many log rows; the page reads the same window. */
const HISTORY_WINDOW = 200;

const ICONS: Record<EditDescription["icon"], LucideIcon> = {
  add: Plus,
  edit: Pencil,
  delete: Trash2,
};

/*
 * Which rows were undone, and which rows are those undos, for this browser session. The log
 * itself does not record it, so another device does not see the "Undone" mark (the undo still
 * shows there as its own entry).
 */
const UNDO_STORAGE_KEY = "tend-activity-undone";
type UndoMarks = { undone: string[]; undos: string[] };

function readMarks(): UndoMarks {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(UNDO_STORAGE_KEY) ?? "null") as UndoMarks;
    if (Array.isArray(parsed?.undone) && Array.isArray(parsed?.undos)) return parsed;
  } catch {
    // Storage blocked or unreadable: start with no marks.
  }
  return { undone: [], undos: [] };
}

function writeMarks(marks: UndoMarks) {
  try {
    sessionStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(marks));
  } catch {
    // Storage blocked: the marks last until the page closes.
  }
}

/** A row can be undone unless it is an update or removal with nothing to put back. */
const canUndo = (e: EditHistoryEntry) => e.operation === "INSERT" || e.old_data !== null;

const control =
  "h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function ActivityRow({
  entry,
  undone,
  isUndo,
  busy,
  onUndo,
}: {
  entry: EditHistoryEntry;
  undone: boolean;
  isUndo: boolean;
  busy: boolean;
  onUndo: () => void;
}) {
  const { title, detail, icon } = describeEdit(entry);
  const Icon = ICONS[icon];
  const area = filterForTable(entry.table_name)?.label;
  return (
    <li data-activity-row={entry.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
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
          {[area, isUndo ? "Undo of an earlier change" : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="shrink-0 pt-0.5">
        {undone ? (
          <StatusChip level="neutral" label="Undone" />
        ) : canUndo(entry) ? (
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
  const [marks, setMarks] = useState<UndoMarks>(readMarks);
  const [busy, setBusy] = useState<string | null>(null);

  const table = search.table ?? "";
  const filter = ACTIVITY_FILTERS.find((f) => f.value === table);

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

  function mark(next: UndoMarks) {
    setMarks(next);
    writeMarks(next);
  }

  async function undo(entry: EditHistoryEntry) {
    setBusy(entry.id);
    const { title } = describeEdit(entry);
    try {
      const { data, error } = await supabase.functions.invoke("dashboard-data", {
        body: { action: "rollback", password, history_id: entry.id },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || "Undo failed");
      if (entry.table_name === "psa_readings") notifyPsaReadingsChanged();
      const fresh = await refresh();
      // The rollback is itself a change, logged as the newest entry for the same record.
      const known = new Set([...marks.undos, ...marks.undone, entry.id]);
      const undoEntry = fresh.find(
        (e) =>
          e.table_name === entry.table_name && e.record_id === entry.record_id && !known.has(e.id),
      );
      mark({
        undone: [...marks.undone, entry.id],
        undos: undoEntry ? [...marks.undos, undoEntry.id] : marks.undos,
      });
      toast.success("Undone", { id: SAVE_TOAST_ID, description: title });
    } catch (e) {
      toast.error("Could not undo", {
        id: SAVE_TOAST_ID,
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(null);
    }
  }

  const undone = new Set(marks.undone);
  const undos = new Set(marks.undos);

  return (
    <Page
      title="Activity"
      description="Every change to the record, newest first. Any of them can be undone."
      wide
    >
      {loading ? (
        <MascotLoader label="Loading activity…" />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Nothing has changed yet"
          body="Edits to the plan, the care team, medications and PSA readings appear here, and any of them can be undone."
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
                        undone={undone.has(e.id)}
                        isUndo={undos.has(e.id)}
                        busy={busy !== null}
                        onUndo={() => void undo(e)}
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
    </Page>
  );
}
