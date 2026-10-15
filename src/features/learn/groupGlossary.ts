// ABOUTME: Sorts glossary terms A to Z and splits them into letter groups for the definition list.

export type GlossaryEntry = { term: string; def: string };

/** Terms sorted A to Z, then split by first letter. */
export function groupGlossary(
  entries: GlossaryEntry[],
): { letter: string; entries: GlossaryEntry[] }[] {
  const sorted = [...entries].sort((a, b) =>
    a.term.localeCompare(b.term, "en", { sensitivity: "base" }),
  );
  const groups: { letter: string; entries: GlossaryEntry[] }[] = [];
  for (const entry of sorted) {
    const letter = entry.term.trim().charAt(0).toUpperCase() || "#";
    const last = groups.at(-1);
    if (last?.letter === letter) last.entries.push(entry);
    else groups.push({ letter, entries: [entry] });
  }
  return groups;
}
