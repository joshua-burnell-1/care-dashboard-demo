// ABOUTME: Shared pager: Previous and Next buttons around numbered pages, the current page marked
// ABOUTME: aria-current="page". Renders nothing when there is only one page.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageWindow } from "@/lib/pageWindow";

const control =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-xl border px-2.5 text-sm font-medium tabular-nums transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40";

export function Pagination({
  page,
  pages,
  onPageChange,
}: {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={`${control} border-line bg-surface pr-3 text-ink hover:bg-secondary`}
      >
        <ChevronLeft size={16} aria-hidden />
        Previous
      </button>
      <ul className="flex items-center gap-1.5">
        {pageWindow(page, pages).map((n, i) =>
          n === null ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-sm text-muted">
              …
            </li>
          ) : (
            <li key={n}>
              <button
                type="button"
                onClick={() => onPageChange(n)}
                aria-label={`Page ${n}`}
                aria-current={n === page ? "page" : undefined}
                className={`${control} ${
                  n === page
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-surface text-ink hover:bg-secondary"
                }`}
              >
                {n}
              </button>
            </li>
          ),
        )}
      </ul>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
        className={`${control} border-line bg-surface pl-3 text-ink hover:bg-secondary`}
      >
        Next
        <ChevronRight size={16} aria-hidden />
      </button>
    </nav>
  );
}
