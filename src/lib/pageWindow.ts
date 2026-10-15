// ABOUTME: Which page numbers a pager shows for a long list: the ends and the current page's
// ABOUTME: neighbors, with a gap marker where numbers are skipped.

/** Page numbers to show, with null for a skipped run: 1 … 4 5 6 … 12. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  // Near either end, show a longer run so the window keeps a steady width.
  if (page <= 3) [2, 3, 4].forEach((n) => wanted.add(n));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => wanted.add(n));
  const shown = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  shown.forEach((n, i) => {
    if (i > 0 && n - shown[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}
