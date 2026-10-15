// ABOUTME: The glossary as an alphabetical definition list, grouped by first letter, with a small
// ABOUTME: filter box that narrows the terms as you type.
import { useMemo, useState } from "react";
import { groupGlossary, type GlossaryEntry } from "./groupGlossary";

export function Glossary({ entries }: { entries: GlossaryEntry[] }) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = q
      ? entries.filter((e) => `${e.term} ${e.def}`.toLowerCase().includes(q))
      : entries;
    return groupGlossary(shown);
  }, [entries, query]);

  if (entries.length === 0) {
    return <p className="mt-5 text-sm text-muted">No glossary terms are recorded yet.</p>;
  }
  return (
    <div className="mt-5">
      <label className="sr-only" htmlFor="glossary-filter">
        Filter glossary terms
      </label>
      <input
        id="glossary-filter"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter terms"
        autoComplete="off"
        className="h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink placeholder:text-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:max-w-xs sm:text-sm"
      />
      {groups.length === 0 ? (
        <p className="mt-6 text-sm text-muted" role="status">
          No terms match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map((g) => (
            <div
              key={g.letter}
              data-letter={g.letter}
              className="grid gap-x-6 sm:grid-cols-[2rem_1fr]"
            >
              <p aria-hidden className="font-display text-2xl leading-none text-muted">
                {g.letter}
              </p>
              <dl className="mt-2 divide-y divide-line sm:mt-0">
                {g.entries.map((e) => (
                  <div key={e.term} className="py-3 first:pt-0 last:pb-0">
                    <dt className="text-base font-medium text-ink">{e.term}</dt>
                    <dd className="mt-1 text-base leading-relaxed text-ink/80">{e.def}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
