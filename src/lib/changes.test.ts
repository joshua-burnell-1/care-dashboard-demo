import { describe, it, expect } from "vitest";
import { buildSeed } from "@/demo/seed";
import { isoDaysFromToday } from "@/demo/dates";
import { TIMELINE } from "@/demo/persona";
import type { Document } from "@/hooks/useDocuments";
import type { EditHistoryEntry } from "@/hooks/useEditHistory";
import type { LabResult } from "@/hooks/useLabResults";
import type { PsaReading } from "@/hooks/usePsaReadings";
import { changesSince, changeWindowStart, tableLabel } from "./changes";

const psa = (id: string, date: string, value: number | null): PsaReading => ({
  id,
  date,
  value,
  unit: "ng/mL",
  phase: "post-rad",
  note: "",
  sort_index: 0,
  created_at: `${date}T09:00:00.000Z`,
  updated_at: `${date}T09:00:00.000Z`,
});

const lab = (id: string, date: string, metric: string, flag: string | null = null): LabResult => ({
  id,
  date,
  metric,
  category: null,
  value_numeric: 1,
  value_text: null,
  unit: "",
  reference_range: null,
  flag,
  source: "",
  source_document_id: null,
  note: "",
  sort_index: 0,
  created_at: `${date}T09:00:00.000Z`,
  updated_at: `${date}T09:00:00.000Z`,
});

const doc = (id: string, uploaded: string, name: string): Document => ({
  id,
  name,
  mime_type: "application/pdf",
  storage_path: `demo/${id}`,
  size_bytes: 1,
  uploaded_at: uploaded,
  status: "indexed",
  error: null,
  extracted_chars: 1,
});

const edit = (
  id: string,
  changedAt: string,
  table: string,
  operation: EditHistoryEntry["operation"] = "UPDATE",
  newData: Record<string, unknown> | null = {},
): EditHistoryEntry => ({
  id,
  table_name: table,
  record_id: id,
  operation,
  old_data: null,
  new_data: newData,
  changed_at: changedAt,
});

const empty = { edits: [], documents: [], labs: [], psa: [] };

describe("changesSince", () => {
  it("keeps only changes on or after the since date", () => {
    const items = changesSince("2026-10-01", {
      ...empty,
      psa: [psa("a", "2026-09-01", 0.085), psa("b", "2026-10-05", 0.11)],
      documents: [doc("d1", "2026-09-20T09:00:00Z", "Old.pdf")],
    });
    expect(items.map((i) => i.id)).toEqual(["psa-b"]);
  });

  it("orders items newest first", () => {
    const items = changesSince("2026-10-01", {
      edits: [edit("e1", "2026-10-12T10:00:00Z", "medication_items")],
      documents: [doc("d1", "2026-10-06T09:00:00Z", "Results.pdf")],
      labs: [lab("l1", "2026-10-03", "Hemoglobin")],
      psa: [psa("a", "2026-09-01", 0.085), psa("b", "2026-10-05", 0.11)],
    });
    expect(items.map((i) => i.kind)).toEqual(["edit", "document", "psa", "lab"]);
  });

  it("links every item somewhere real", () => {
    const items = changesSince("2026-10-01", {
      edits: [edit("e1", "2026-10-12T10:00:00Z", "medication_items")],
      documents: [doc("d1", "2026-10-06T09:00:00Z", "Results.pdf")],
      labs: [lab("l1", "2026-10-03", "Hemoglobin"), lab("l2", "2026-10-03", "Glucose", "HIGH")],
      psa: [psa("b", "2026-10-05", 0.11)],
    });
    const to = Object.fromEntries(items.map((i) => [i.kind, i.to]));
    expect(to).toEqual({
      edit: "/activity",
      document: "/documents/d1",
      psa: "/labs/psa",
      lab: "/labs",
    });
  });

  it("describes a PSA result against the reading before it", () => {
    const [item] = changesSince("2026-10-01", {
      ...empty,
      psa: [psa("a", "2026-09-01", 0.085), psa("b", "2026-10-05", 0.11)],
    });
    expect(item.title).toBe("New PSA: 0.11 ng/mL");
    expect(item.detail).toBe("Up from 0.085");
  });

  it("groups a day's lab panel into one item, counts results outside range, and skips PSA rows", () => {
    const items = changesSince("2026-10-01", {
      ...empty,
      labs: [
        lab("l1", "2026-10-03", "Hemoglobin", "LOW"),
        lab("l2", "2026-10-03", "Glucose", "HIGH"),
        lab("l3", "2026-10-03", "Sodium"),
        lab("l4", "2026-10-03", "PSA Total"),
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("New lab results: 3 tests");
    expect(items[0].detail).toBe("2 outside the reference range");
  });

  it("links a single lab result straight to its metric page", () => {
    const [item] = changesSince("2026-10-01", {
      ...empty,
      labs: [lab("l1", "2026-10-03", "Hemoglobin")],
    });
    expect(item.to).toBe("/labs/hemoglobin");
  });

  it("folds the family's edits into one item so results stay in view", () => {
    const items = changesSince("2026-10-01", {
      ...empty,
      edits: [
        edit("e1", "2026-10-12T10:00:00Z", "medication_items"),
        edit("e2", "2026-10-10T10:00:00Z", "plan_items", "INSERT"),
        edit("e3", "2026-10-08T10:00:00Z", "medication_items"),
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "edit",
      title: "3 edits to the record",
      detail: "Medication, Plan item",
      date: "2026-10-12T10:00:00Z",
      to: "/activity",
    });
  });

  it("names a single edit by what changed", () => {
    const [item] = changesSince("2026-10-01", {
      ...empty,
      edits: [edit("e1", "2026-10-12T10:00:00Z", "plan_items", "INSERT", { title: "Scan" })],
    });
    expect(item.title).toBe("Plan item added");
    expect(item.detail).toBe("Scan");
  });

  it("finds the seeded PSA result, documents and edits since the last plan item", () => {
    const today = new Date(2026, 9, 15, 12);
    const s = buildSeed(today);
    const since = changeWindowStart(s.plan_items, isoDaysFromToday(0, today));
    const items = changesSince(since.date, {
      edits: s.edit_history,
      documents: s.documents,
      labs: s.lab_results,
      psa: s.psa_readings,
    });
    expect(items.map((i) => i.kind)).toEqual(["edit", "document", "psa", "lab"]);
    expect(items.find((i) => i.kind === "psa")!.title).toBe("New PSA: 0.11 ng/mL");
  });
});

describe("changeWindowStart", () => {
  const plan = (id: string, event_date: string | null, title = id) => ({ id, event_date, title });

  it("starts at the most recent past plan item", () => {
    const start = changeWindowStart(
      [plan("a", "2026-09-01"), plan("b", "2026-10-05", "PSA drawn"), plan("c", "2026-10-20")],
      "2026-10-15",
    );
    expect(start).toEqual({ date: "2026-10-05", label: "PSA drawn" });
  });

  it("falls back to 30 days ago when nothing is in the past", () => {
    expect(changeWindowStart([plan("c", "2026-10-20"), plan("d", null)], "2026-10-15")).toEqual({
      date: "2026-09-15",
      label: null,
    });
  });

  it("uses the seed's completed PSA draw", () => {
    const today = new Date(2026, 9, 15, 12);
    const s = buildSeed(today);
    expect(changeWindowStart(s.plan_items, isoDaysFromToday(0, today)).date).toBe(
      s.psa_readings.at(-1)!.date,
    );
    expect(TIMELINE.nextVisit).toBeGreaterThan(0);
  });
});

describe("tableLabel", () => {
  it("names known tables and passes others through", () => {
    expect(tableLabel("psa_readings")).toBe("PSA reading");
    expect(tableLabel("mystery")).toBe("mystery");
  });
});
