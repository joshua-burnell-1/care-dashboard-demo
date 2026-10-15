import { describe, expect, it } from "vitest";
import {
  formatLabValue,
  groupLabs,
  labStatus,
  mergeLabs,
  metricSlug,
  normalizeFlag,
  paginate,
  paginateGroups,
  parseReferenceRange,
  type LabResult,
} from "./labs";

describe("metricSlug", () => {
  it("lowercases and joins words with dashes", () => {
    expect(metricSlug("Hemoglobin")).toBe("hemoglobin");
    expect(metricSlug("PSA Total")).toBe("psa-total");
  });

  it("gives variants of one metric the same slug", () => {
    expect(metricSlug("PSA, Total")).toBe(metricSlug("Total PSA"));
    expect(metricSlug("HbA1c (Hemoglobin A1c)")).toBe(metricSlug("A1c"));
  });

  it("is stable when given a display label", () => {
    expect(metricSlug("MCH (Mean Cell Hemoglobin)")).toBe("mch");
  });

  it("is url-safe", () => {
    expect(metricSlug("Vitamin B12 / Folate #2")).toMatch(/^[a-z0-9-]+$/);
    expect(encodeURIComponent(metricSlug("eGFR (mL/min/1.73m²)"))).toBe(
      metricSlug("eGFR (mL/min/1.73m²)"),
    );
  });

  it("returns an empty slug for a name with no letters or digits", () => {
    expect(metricSlug("()")).toBe("");
  });
});

const lab = (over: Partial<LabResult> & { metric: string }): LabResult => ({
  value: 1,
  ...over,
});

const LABS: LabResult[] = [
  lab({
    metric: "Hemoglobin",
    category: "CBC",
    value: 13.8,
    unit: "g/dL",
    date: "2026-04-01",
    source: "Northgate Lab",
  }),
  lab({
    metric: "Hemoglobin",
    category: "CBC",
    value: 13.1,
    unit: "g/dL",
    date: "2026-06-01",
    flag: "LOW",
    source: "Northgate Lab",
  }),
  lab({
    metric: "Glucose",
    category: "Chemistry",
    value: 108,
    unit: "mg/dL",
    date: "2026-06-01",
    flag: "HIGH",
    source: "Riverside Lab",
  }),
  lab({
    metric: "Sodium",
    category: "Chemistry",
    value: 140,
    unit: "mmol/L",
    date: "2026-05-01",
    flag: "NORMAL",
  }),
  lab({ metric: "Mystery marker", value: "trace", date: "2026-02-01" }),
];

const names = (groups: ReturnType<typeof groupLabs>) =>
  groups.map((g) => ({ panel: g.panel, metrics: g.metrics.map((m) => m.name) }));

describe("groupLabs", () => {
  it("groups by panel, one entry per metric, with the latest reading and a dated series", () => {
    const groups = groupLabs(LABS, {});
    expect(names(groups)).toEqual([
      { panel: "CBC", metrics: ["Hemoglobin"] },
      { panel: "Chemistry", metrics: ["Glucose", "Sodium"] },
      { panel: "Other", metrics: ["Mystery marker"] },
    ]);
    const hgb = groups[0].metrics[0];
    expect(hgb.slug).toBe("hemoglobin");
    expect(hgb.latest.value).toBe(13.1);
    expect(hgb.series).toEqual([
      { date: "2026-04-01", value: 13.8 },
      { date: "2026-06-01", value: 13.1 },
    ]);
    expect(hgb.readings.map((r) => r.date)).toEqual(["2026-06-01", "2026-04-01"]);
  });

  it("collapses name variants into one metric", () => {
    const groups = groupLabs(
      [
        lab({ metric: "PSA, Total", category: "PSA", date: "2026-01-01" }),
        lab({ metric: "Total PSA", category: "PSA", date: "2026-02-01" }),
      ],
      {},
    );
    expect(groups[0].metrics).toHaveLength(1);
    expect(groups[0].metrics[0].readings).toHaveLength(2);
  });

  it("flags a metric from its latest reading only", () => {
    const flat = groupLabs(LABS, {}).flatMap((g) => g.metrics);
    const flag = (name: string) => flat.find((m) => m.name === name)?.flag;
    expect(flag("Hemoglobin")).toBe("low");
    expect(flag("Glucose")).toBe("high");
    expect(flag("Sodium")).toBeUndefined();

    const recovered = groupLabs(
      [
        lab({ metric: "Glucose", date: "2026-01-01", flag: "HIGH" }),
        lab({ metric: "Glucose", date: "2026-03-01", flag: "NORMAL" }),
      ],
      {},
    );
    expect(recovered[0].metrics[0].flag).toBeUndefined();
  });

  it("keeps only flagged metrics with abnormal", () => {
    expect(names(groupLabs(LABS, { abnormal: true }))).toEqual([
      { panel: "CBC", metrics: ["Hemoglobin"] },
      { panel: "Chemistry", metrics: ["Glucose"] },
    ]);
  });

  it("filters to one panel", () => {
    expect(names(groupLabs(LABS, { panel: "Chemistry" }))).toEqual([
      { panel: "Chemistry", metrics: ["Glucose", "Sodium"] },
    ]);
  });

  it("searches name, panel and source, ignoring case", () => {
    expect(names(groupLabs(LABS, { q: "HEMO" }))).toEqual([
      { panel: "CBC", metrics: ["Hemoglobin"] },
    ]);
    expect(groupLabs(LABS, { q: "chem" })[0].metrics.map((m) => m.name)).toEqual([
      "Glucose",
      "Sodium",
    ]);
    expect(names(groupLabs(LABS, { q: "riverside" }))).toEqual([
      { panel: "Chemistry", metrics: ["Glucose"] },
    ]);
    expect(groupLabs(LABS, { q: "no such thing" })).toEqual([]);
  });

  it("searches by canonical name for an alias", () => {
    const groups = groupLabs([lab({ metric: "Total PSA", category: "PSA" })], { q: "psa total" });
    expect(groups[0].metrics).toHaveLength(1);
  });

  it("sorts by latest date, newest first, then by name", () => {
    const chem = groupLabs(LABS, { sort: "date" }).find((g) => g.panel === "Chemistry")!;
    // Glucose 06-01 is newer than Sodium 05-01.
    expect(chem.metrics.map((m) => m.name)).toEqual(["Glucose", "Sodium"]);
    const flipped = groupLabs(
      [
        lab({ metric: "Aaa", category: "X", date: "2026-01-01" }),
        lab({ metric: "Zzz", category: "X", date: "2026-02-01" }),
      ],
      { sort: "date" },
    );
    expect(flipped[0].metrics.map((m) => m.name)).toEqual(["Zzz", "Aaa"]);
  });

  it("sorts by name", () => {
    const groups = groupLabs(
      [
        lab({ metric: "Zzz", category: "X", date: "2026-02-01" }),
        lab({ metric: "Aaa", category: "X", date: "2026-01-01" }),
      ],
      { sort: "name" },
    );
    expect(groups[0].metrics.map((m) => m.name)).toEqual(["Aaa", "Zzz"]);
  });

  it("puts undated metrics last when sorting by date", () => {
    const groups = groupLabs(
      [
        lab({ metric: "Aaa", category: "X" }),
        lab({ metric: "Bbb", category: "X", date: "2026-01-01" }),
      ],
      { sort: "date" },
    );
    expect(groups[0].metrics.map((m) => m.name)).toEqual(["Bbb", "Aaa"]);
  });

  it("leaves text-only results out of the series but keeps them as the latest", () => {
    const [group] = groupLabs(
      [lab({ metric: "Mystery marker", value: "trace", date: "2026-02-01" })],
      {},
    );
    expect(group.metrics[0].series).toEqual([]);
    expect(group.metrics[0].latest.value).toBe("trace");
  });

  it("ignores rows with no usable metric name", () => {
    expect(groupLabs([lab({ metric: "" }), lab({ metric: "()" })], {})).toEqual([]);
  });

  it("returns every group's panel name in a stable order with Other last", () => {
    const panels = groupLabs(
      [
        lab({ metric: "A" }),
        lab({ metric: "B", category: "Zeta" }),
        lab({ metric: "C", category: "Alpha" }),
      ],
      {},
    ).map((g) => g.panel);
    expect(panels).toEqual(["Alpha", "Zeta", "Other"]);
  });
});

describe("normalizeFlag", () => {
  it("reads high and low in their usual spellings", () => {
    expect(normalizeFlag("HIGH")).toBe("high");
    expect(normalizeFlag("H")).toBe("high");
    expect(normalizeFlag("Critical high")).toBe("high");
    expect(normalizeFlag("LOW")).toBe("low");
    expect(normalizeFlag("l")).toBe("low");
  });

  it("treats normal, blank and unknown flags as not flagged", () => {
    expect(normalizeFlag("NORMAL")).toBeUndefined();
    expect(normalizeFlag("")).toBeUndefined();
    expect(normalizeFlag(undefined)).toBeUndefined();
    expect(normalizeFlag("n/a")).toBeUndefined();
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 19 }, (_, i) => i + 1);

  it("slices a page and counts pages", () => {
    expect(paginate(items, 1, 8)).toEqual({ items: [1, 2, 3, 4, 5, 6, 7, 8], page: 1, pages: 3 });
    expect(paginate(items, 3, 8)).toEqual({ items: [17, 18, 19], page: 3, pages: 3 });
  });

  it("clamps an out-of-range page", () => {
    expect(paginate(items, 99, 8).page).toBe(3);
    expect(paginate(items, 0, 8).page).toBe(1);
    expect(paginate(items, -4, 8).page).toBe(1);
    expect(paginate(items, Number.NaN, 8).page).toBe(1);
    expect(paginate(items, 2.7, 8).page).toBe(2);
  });

  it("gives one empty page for no items", () => {
    expect(paginate([], 1, 8)).toEqual({ items: [], page: 1, pages: 1 });
  });

  it("treats an exact multiple as no extra page", () => {
    expect(paginate(items.slice(0, 16), 2, 8)).toEqual({
      items: [9, 10, 11, 12, 13, 14, 15, 16],
      page: 2,
      pages: 2,
    });
  });
});

describe("paginateGroups", () => {
  const many: LabResult[] = Array.from({ length: 10 }, (_, i) =>
    lab({ metric: `Metric ${String.fromCharCode(65 + i)}`, category: i < 6 ? "One" : "Two" }),
  );

  it("pages across groups by metric, repeating a split group's heading", () => {
    const groups = groupLabs(many, { sort: "name" });
    const first = paginateGroups(groups, 1, 8);
    expect(first.pages).toBe(2);
    expect(first.total).toBe(10);
    expect(first.groups.map((g) => [g.panel, g.metrics.length])).toEqual([
      ["One", 6],
      ["Two", 2],
    ]);
    const second = paginateGroups(groups, 2, 8);
    expect(second.groups.map((g) => [g.panel, g.metrics.length])).toEqual([["Two", 2]]);
    expect(second.page).toBe(2);
  });

  it("clamps the page", () => {
    const groups = groupLabs(many, {});
    expect(paginateGroups(groups, 50, 8).page).toBe(2);
  });
});

describe("parseReferenceRange", () => {
  it("reads a low to high range with an en dash, hyphen or 'to'", () => {
    expect(parseReferenceRange("4.0–11.0")).toEqual({ low: 4, high: 11 });
    expect(parseReferenceRange("70-99")).toEqual({ low: 70, high: 99 });
    expect(parseReferenceRange("13.5 to 17.5")).toEqual({ low: 13.5, high: 17.5 });
  });

  it("reads one-sided ranges", () => {
    expect(parseReferenceRange("≥60")).toEqual({ low: 60 });
    expect(parseReferenceRange(">= 60")).toEqual({ low: 60 });
    expect(parseReferenceRange("<0.10 after treatment")).toEqual({ high: 0.1 });
    expect(parseReferenceRange("<=5")).toEqual({ high: 5 });
  });

  it("returns null for text it cannot read", () => {
    expect(parseReferenceRange("negative")).toBeNull();
    expect(parseReferenceRange(undefined)).toBeNull();
    expect(parseReferenceRange("")).toBeNull();
  });
});

describe("mergeLabs", () => {
  const uploaded = {
    id: "u1",
    date: "2026-06-01",
    metric: "Hemoglobin",
    category: "CBC",
    value_numeric: 13.1,
    value_text: null,
    unit: "g/dL",
    reference_range: "13.5–17.5",
    flag: "LOW",
    source: "",
    source_document_id: null,
    note: "",
    sort_index: 0,
    created_at: "",
    updated_at: "",
  };

  it("adapts uploaded rows and labels a blank source as an upload", () => {
    const [row] = mergeLabs([uploaded], []);
    expect(row).toMatchObject({
      metric: "Hemoglobin",
      value: 13.1,
      unit: "g/dL",
      reference_range: "13.5–17.5",
      flag: "LOW",
      source: "upload",
    });
    expect(row.note).toBeUndefined();
  });

  it("uses the text value when there is no number", () => {
    const [row] = mergeLabs([{ ...uploaded, value_numeric: null, value_text: "trace" }], []);
    expect(row.value).toBe("trace");
  });

  it("drops a cached row that repeats an uploaded one, keeping the uploaded", () => {
    const merged = mergeLabs(
      [uploaded],
      [
        { date: "2026-06-01", metric: "hemoglobin", value: 13.1, source: "cache" },
        { date: "2026-06-01", metric: "Hemoglobin", value: 14.0 },
      ],
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].source).toBe("upload");
  });
});

describe("formatLabValue", () => {
  it("keeps up to three decimals and groups thousands", () => {
    expect(formatLabValue(0.008)).toBe("0.008");
    expect(formatLabValue(13.1)).toBe("13.1");
    expect(formatLabValue(1234)).toBe("1,234");
  });

  it("passes text through and names a missing value", () => {
    expect(formatLabValue("trace")).toBe("trace");
    expect(formatLabValue(null)).toBe("None");
  });
});

describe("labStatus", () => {
  it("is High or Low when the lab flagged it", () => {
    expect(labStatus(lab({ metric: "x", flag: "HIGH" }))).toEqual({
      level: "watch",
      label: "High",
    });
    expect(labStatus(lab({ metric: "x", flag: "low" }))).toEqual({ level: "watch", label: "Low" });
  });

  it("is In range for a normal flag or a number inside its range", () => {
    expect(labStatus(lab({ metric: "x", flag: "NORMAL" })).level).toBe("stable");
    expect(labStatus(lab({ metric: "x", value: 5, reference_range: "4.0–11.0" })).label).toBe(
      "In range",
    );
  });

  it("is neutral when there is nothing to judge by, or the number is outside an unflagged range", () => {
    expect(labStatus(lab({ metric: "x", value: "trace" }))).toEqual({
      level: "neutral",
      label: "No flag",
    });
    expect(labStatus(lab({ metric: "x", value: 12, reference_range: "4.0–11.0" })).level).toBe(
      "neutral",
    );
  });
});
