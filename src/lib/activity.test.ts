import { describe, expect, it } from "vitest";
import type { EditHistoryEntry } from "@/hooks/useEditHistory";
import {
  ACTIVITY_FILTERS,
  describeEdit,
  filterForTable,
  groupByDay,
  possessive,
  type ActivityFilter,
} from "./activity";

type Row = Record<string, unknown>;

const entry = (
  table: string,
  operation: EditHistoryEntry["operation"],
  oldData: Row | null,
  newData: Row | null,
  changedAt = "2026-10-12T10:00:00.000Z",
): EditHistoryEntry => ({
  id: `${table}-${operation}`,
  table_name: table,
  record_id: String((newData ?? oldData)?.id ?? (newData ?? oldData)?.key ?? "r1"),
  operation,
  old_data: oldData,
  new_data: newData,
  changed_at: changedAt,
});

const stamps = {
  created_at: "2026-03-29T09:00:00.000Z",
  updated_at: "2026-10-12T10:00:00.000Z",
  sort_index: 0,
};

/** One plausible row per audited table (plus the unaudited ones a log may still name). */
const ROWS: Record<string, Row> = {
  plan_items: {
    id: "p1",
    title: "PSMA PET/CT scan",
    body: "Bring the referral.",
    status: "Scheduled",
    event_date: "2026-10-28",
    ...stamps,
  },
  medication_items: {
    id: "m1",
    item: "Vitamin D3",
    dose: "2,000 IU once daily",
    purpose: "Bone health",
    started_by: "Dr. Jane Smith",
    ...stamps,
  },
  care_team_members: {
    id: "c1",
    name: "Dr. Jane Smith",
    role: "Medical oncology",
    where_based: "Springfield Clinic",
    note: "Leads follow-up",
    phone: "(555) 010-0100",
    email: "jane.smith@example.com",
    ...stamps,
  },
  psa_readings: {
    id: "s1",
    date: "2026-10-06",
    value: 0.11,
    unit: "ng/mL",
    phase: "post-rad",
    note: "",
    ...stamps,
  },
  kpi_cards: { id: "k1", label: "Next scan", value: "Oct 28", sub: "", tone: "info", ...stamps },
  dashboard_sections: { key: "summary", content: ["One line."], updated_at: stamps.updated_at },
  lab_results: {
    id: "l1",
    metric: "Hemoglobin",
    value_numeric: 13.3,
    value_text: null,
    unit: "g/dL",
    date: "2026-09-16",
    ...stamps,
  },
  documents: {
    id: "d1",
    name: "Lab report.pdf",
    status: "indexed",
    uploaded_at: stamps.updated_at,
  },
};

const OPERATIONS: EditHistoryEntry["operation"][] = ["INSERT", "UPDATE", "DELETE"];

/** Never shown to people: table names, SQL operation codes, ISO dates, raw field names. */
const MACHINE_WORDS =
  /INSERT|UPDATE|DELETE|_items|_readings|_members|_cards|_sections|_results|\d{4}-\d{2}-\d{2}|event_date|where_based|started_by|undefined|null|\[object/;

function sample(table: string, op: EditHistoryEntry["operation"]): EditHistoryEntry {
  const row = ROWS[table];
  if (op === "INSERT") return entry(table, op, null, row);
  if (op === "DELETE") return entry(table, op, row, null);
  // An update that touches the first descriptive field after the key.
  const field = Object.keys(row).find((k) => !["id", "key"].includes(k))!;
  const changed = Array.isArray(row[field]) ? ["Two lines.", "Now."] : `${String(row[field])} x`;
  return entry(table, op, row, { ...row, [field]: changed });
}

describe("describeEdit", () => {
  for (const table of Object.keys(ROWS)) {
    for (const op of OPERATIONS) {
      it(`describes ${table} ${op} in plain words`, () => {
        const d = describeEdit(sample(table, op));
        expect(d.title.length).toBeGreaterThan(0);
        expect(d.title).not.toMatch(MACHINE_WORDS);
        expect(d.detail ?? "").not.toMatch(MACHINE_WORDS);
        expect(`${d.title} ${d.detail ?? ""}`).not.toContain("—");
        expect(d.icon).toBe(op === "INSERT" ? "add" : op === "DELETE" ? "delete" : "edit");
      });
    }
  }

  it("names an added plan item by its title", () => {
    const d = describeEdit(entry("plan_items", "INSERT", null, ROWS.plan_items));
    expect(d.title).toBe("Added plan item: PSMA PET/CT scan");
    expect(d.detail).toBe("Oct 28, 2026");
  });

  it("names the changed field of a medication", () => {
    const old = { ...ROWS.medication_items, dose: "1,000 IU once daily" };
    const d = describeEdit(entry("medication_items", "UPDATE", old, ROWS.medication_items));
    expect(d.title).toBe("Changed Vitamin D3 dose");
    expect(d.detail).toBe("1,000 IU once daily to 2,000 IU once daily");
  });

  it("uses a possessive for a care team member's field", () => {
    const old = { ...ROWS.care_team_members, note: "Performed the surgery" };
    const d = describeEdit(entry("care_team_members", "UPDATE", old, ROWS.care_team_members));
    expect(d.title).toBe("Updated Dr. Jane Smith's notes");
    expect(d.detail).toBe("Leads follow-up");
  });

  it("formats dates in a field diff and never shows them raw", () => {
    const old = { ...ROWS.plan_items, event_date: "2026-10-21" };
    const d = describeEdit(entry("plan_items", "UPDATE", old, ROWS.plan_items));
    expect(d.title).toBe("Moved PSMA PET/CT scan");
    expect(d.detail).toBe("Oct 21, 2026 to Oct 28, 2026");
  });

  it("lists several changed fields in words", () => {
    const old = { ...ROWS.care_team_members, phone: "", email: "old@example.com" };
    const d = describeEdit(entry("care_team_members", "UPDATE", old, ROWS.care_team_members));
    expect(d.title).toBe("Updated Dr. Jane Smith's details");
    expect(d.detail).toBe("Changed the phone number and email");
  });

  it("says what a cleared or newly set value became", () => {
    const set = describeEdit(
      entry(
        "medication_items",
        "UPDATE",
        { ...ROWS.medication_items, dose: "" },
        ROWS.medication_items,
      ),
    );
    expect(set.detail).toBe("Set to 2,000 IU once daily");
    const cleared = describeEdit(
      entry("medication_items", "UPDATE", ROWS.medication_items, {
        ...ROWS.medication_items,
        dose: "",
      }),
    );
    expect(cleared.detail).toBe("Cleared (was 2,000 IU once daily)");
  });

  it("describes a PSA value change with its unit and the reading's date", () => {
    const old = { ...ROWS.psa_readings, value: 0.1 };
    const d = describeEdit(entry("psa_readings", "UPDATE", old, ROWS.psa_readings));
    expect(d.title).toBe("Changed the PSA reading from Oct 6, 2026");
    expect(d.detail).toBe("0.1 to 0.11 ng/mL");
  });

  it("names a dashboard section, not its key", () => {
    const d = describeEdit(
      entry(
        "dashboard_sections",
        "UPDATE",
        { key: "red_flags", content: [] },
        { key: "red_flags", content: [{ title: "Fever" }] },
      ),
    );
    expect(d.title).toBe("Updated the red flags");
  });

  it("falls back to a human sentence for an unknown table", () => {
    for (const op of OPERATIONS) {
      const d = describeEdit(entry("mystery_things", op, { id: "x" }, { id: "x", a: 1 }));
      expect(d.title).toMatch(/^(Added|Updated|Removed) a record$/);
      expect(d.title).not.toMatch(MACHINE_WORDS);
    }
  });

  it("calls an update that changed nothing visible a plain update", () => {
    const d = describeEdit(
      entry("medication_items", "UPDATE", ROWS.medication_items, {
        ...ROWS.medication_items,
        updated_at: "2026-10-13T10:00:00.000Z",
        sort_index: 3,
      }),
    );
    expect(d.title).toBe("Updated Vitamin D3");
    expect(d.detail).toBeUndefined();
  });
});

describe("possessive", () => {
  it("adds 's, or only an apostrophe after an s, and drops a trailing credential", () => {
    expect(possessive("Dr. Jane Smith")).toBe("Dr. Jane Smith's");
    expect(possessive("Dr. Helen Brooks")).toBe("Dr. Helen Brooks'");
    expect(possessive("Dana Lee, LCSW")).toBe("Dana Lee's");
  });
});

describe("groupByDay", () => {
  const now = new Date(2026, 9, 15, 12, 0, 0);
  const at = (d: number, h = 10) => new Date(2026, 9, d, h, 0, 0).toISOString();

  it("labels today and yesterday, then dates, newest first", () => {
    const groups = groupByDay(
      [
        entry("plan_items", "INSERT", null, ROWS.plan_items, at(15, 9)),
        entry("plan_items", "INSERT", null, ROWS.plan_items, at(15, 8)),
        entry("plan_items", "INSERT", null, ROWS.plan_items, at(14)),
        entry("plan_items", "INSERT", null, ROWS.plan_items, at(9)),
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.entries.length])).toEqual([
      ["Today", 2],
      ["Yesterday", 1],
      ["Oct 9, 2026", 1],
    ]);
  });
});

describe("activity filters", () => {
  it("uses human names and maps each audited table to one", () => {
    const labels = ACTIVITY_FILTERS.map((f: ActivityFilter) => f.label);
    expect(labels).toEqual(expect.arrayContaining(["Plan", "Labs", "Team", "Medications"]));
    for (const table of Object.keys(ROWS)) expect(filterForTable(table)).toBeDefined();
    expect(filterForTable("psa_readings")!.label).toBe("Labs");
    expect(filterForTable("mystery")).toBeUndefined();
  });
});
