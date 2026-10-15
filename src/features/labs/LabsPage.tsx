// ABOUTME: The /labs index: every lab metric grouped by panel, with search, a panel filter, an
// ABOUTME: abnormal-only switch, sort and pagination, all kept in the URL so a reload restores them.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDown, Search, X } from "lucide-react";
import { MascotLoader } from "@/components/MascotLoader";
import { Pagination } from "@/components/Pagination";
import { Page } from "@/components/shell/Page";
import { Switch } from "@/components/ui/switch";
import { groupLabs, paginateGroups, type LabSort } from "@/lib/labs";
import { LabGroup } from "./LabGroup";
import { useLabs } from "./useLabs";

const PAGE_SIZE = 8;

const SORTS: { value: LabSort; label: string }[] = [
  { value: "date", label: "Newest first" },
  { value: "name", label: "Name, A to Z" },
];

const control =
  "h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function LabsPage() {
  const search = useSearch({ from: "/labs/" });
  const navigate = useNavigate({ from: "/labs/" });
  const { labs, loading } = useLabs();

  const q = search.q ?? "";
  const panel = search.panel ?? "";
  const abnormal = search.abnormal ?? false;
  const sort = search.sort ?? "date";

  // The text box holds what was typed; the URL follows it, and follows back and forward too.
  const [typed, setTyped] = useState(q);
  const lastWritten = useRef(q);
  useEffect(() => {
    if (q !== lastWritten.current) {
      lastWritten.current = q;
      setTyped(q);
    }
  }, [q]);

  /** Change filters; anything but the page resets to page 1 and drops values that are defaults. */
  function setFilters(next: { q?: string; panel?: string; abnormal?: boolean; sort?: LabSort }) {
    const merged = { q, panel, abnormal, sort, ...next };
    void navigate({
      search: {
        q: merged.q.trim() ? merged.q : undefined,
        panel: merged.panel || undefined,
        abnormal: merged.abnormal || undefined,
        sort: merged.sort === "date" ? undefined : merged.sort,
        page: undefined,
      },
      replace: next.q !== undefined,
      resetScroll: false,
    });
  }

  function clearFilters() {
    lastWritten.current = "";
    setTyped("");
    void navigate({ search: {}, resetScroll: false });
  }

  const all = useMemo(() => groupLabs(labs), [labs]);
  const filtered = useMemo(
    () => groupLabs(labs, { q, panel, abnormal, sort }),
    [labs, q, panel, abnormal, sort],
  );
  const paged = useMemo(
    () => paginateGroups(filtered, search.page ?? 1, PAGE_SIZE),
    [filtered, search.page],
  );
  // A page number past the end (or below 1) was clamped for display; make the URL say so.
  const requestedPage = search.page;
  useEffect(() => {
    if (loading || requestedPage === undefined || requestedPage === paged.page) return;
    void navigate({
      search: (prev) => ({ ...prev, page: paged.page === 1 ? undefined : paged.page }),
      replace: true,
      resetScroll: false,
    });
  }, [loading, requestedPage, paged.page, navigate]);

  const panelTotals = useMemo(
    () => new Map(filtered.map((g) => [g.panel, g.metrics.length])),
    [filtered],
  );
  const totalMetrics = all.reduce((n, g) => n + g.metrics.length, 0);
  const filtering = Boolean(q.trim() || panel || abnormal);

  const description = loading
    ? undefined
    : `${totalMetrics} ${totalMetrics === 1 ? "result" : "results"} across ${all.length} ${all.length === 1 ? "panel" : "panels"}`;

  return (
    <Page title="Labs" description={description} wide>
      {loading ? (
        <MascotLoader label="Loading labs…" />
      ) : totalMetrics === 0 ? (
        <p className="rounded-[20px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
          No lab results yet. Upload a lab report on the Documents page and its values will appear
          here.
        </p>
      ) : (
        <div className="space-y-5">
          <form
            role="search"
            aria-label="Filter lab results"
            onSubmit={(e) => e.preventDefault()}
            className="flex flex-wrap items-center gap-2 sm:gap-3"
          >
            <div className="relative min-w-0 basis-full sm:basis-64 sm:flex-1">
              <Search
                size={16}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />
              <input
                type="search"
                aria-label="Search lab results"
                placeholder="Search by name, panel or lab"
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value);
                  lastWritten.current = e.target.value.trim() ? e.target.value : "";
                  setFilters({ q: e.target.value });
                }}
                className={`${control} w-full pl-9 placeholder:text-muted`}
              />
            </div>

            <div className="relative min-w-0 basis-full sm:basis-auto sm:flex-none">
              <select
                aria-label="Panel"
                value={panel}
                onChange={(e) => setFilters({ panel: e.target.value })}
                className={`${control} w-full appearance-none pr-9 sm:w-56`}
              >
                <option value="">All panels</option>
                {all.map((g) => (
                  <option key={g.panel} value={g.panel}>
                    {g.panel}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
              />
            </div>

            <div className="relative min-w-0 flex-1 sm:flex-none">
              <select
                aria-label="Sort"
                value={sort}
                onChange={(e) => setFilters({ sort: e.target.value as LabSort })}
                className={`${control} w-full appearance-none pr-9 sm:w-40`}
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
              />
            </div>

            <label className="flex h-10 cursor-pointer items-center gap-2 text-sm text-ink">
              <Switch
                checked={abnormal}
                onCheckedChange={(checked) => setFilters({ abnormal: checked })}
                aria-label="Abnormal only"
              />
              Abnormal only
            </label>
          </form>

          <p role="status" className="text-sm text-muted tabular-nums">
            {paged.total === 0
              ? "No results"
              : `Showing ${(paged.page - 1) * PAGE_SIZE + 1} to ${Math.min(paged.page * PAGE_SIZE, paged.total)} of ${paged.total} ${paged.total === 1 ? "result" : "results"}`}
            {filtering && paged.total > 0 && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded-md text-ink underline underline-offset-2"
                >
                  <X size={12} aria-hidden />
                  Clear filters
                </button>
              </>
            )}
          </p>

          {paged.total === 0 ? (
            <div className="rounded-[20px] border border-dashed border-line px-5 py-12 text-center">
              <p className="font-display text-2xl text-ink">No results match these filters</p>
              <p className="mt-1 text-sm text-muted">Try a different search, or show everything.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 inline-flex h-10 items-center rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {paged.groups.map((group, i) => (
                <LabGroup
                  key={`${group.panel}-${i}`}
                  total={panelTotals.get(group.panel) ?? group.metrics.length}
                  group={group}
                  id={`panel-${paged.page}-${i}`}
                />
              ))}
            </div>
          )}

          <div className="pt-1">
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
        </div>
      )}
    </Page>
  );
}
