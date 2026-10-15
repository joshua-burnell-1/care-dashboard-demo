import { describe, expect, it } from "vitest";
import { groupGlossary } from "./groupGlossary";

describe("groupGlossary", () => {
  it("sorts terms A to Z ignoring case and groups them by first letter", () => {
    const groups = groupGlossary([
      { term: "PSMA PET/CT", def: "c" },
      { term: "adjuvant radiation", def: "a" },
      { term: "Biochemical recurrence", def: "b" },
      { term: "PSA doubling time", def: "d" },
    ]);
    expect(groups.map((g) => g.letter)).toEqual(["A", "B", "P"]);
    expect(groups[2].entries.map((e) => e.term)).toEqual(["PSA doubling time", "PSMA PET/CT"]);
  });

  it("returns no groups for no terms", () => {
    expect(groupGlossary([])).toEqual([]);
  });
});
