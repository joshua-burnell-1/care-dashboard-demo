import { describe, it, expect } from "vitest";
import { daysBetween } from "./dates";
import { jsonEqual, reanchorTables, shiftDates } from "./reanchor";
import { buildSeed } from "./seed";

describe("shiftDates", () => {
  it("moves dates and timestamps at any depth and leaves other strings alone", () => {
    const row = {
      date: "2026-02-27",
      created_at: "2026-02-27T09:00:00.000Z",
      note: "Drawn on 2026-02-27, see notes",
      nested: { old_data: { event_date: "2026-03-01" }, list: ["2025-12-31", 4, null] },
    };
    expect(shiftDates(row, 3)).toEqual({
      date: "2026-03-02",
      created_at: "2026-03-02T09:00:00.000Z",
      note: "Drawn on 2026-02-27, see notes",
      nested: { old_data: { event_date: "2026-03-04" }, list: ["2026-01-03", 4, null] },
    });
  });
  it("counts calendar days across month and year ends", () => {
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(daysBetween("2026-03-01", "2026-02-27")).toBe(-2);
  });
});

describe("jsonEqual", () => {
  it("ignores key order but not values", () => {
    expect(jsonEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(jsonEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(jsonEqual([1, 2], [2, 1])).toBe(false);
  });
});

describe("reanchorTables", () => {
  const before = new Date("2026-09-04T12:00:00");
  const after = new Date("2026-10-14T12:00:00");
  const pk = (t: string) => (t === "dashboard_sections" ? "key" : "id");

  it("rebuilds untouched seed rows and shifts edited or added ones", () => {
    const stored = buildSeed(before);
    const edited = { ...stored.plan_items[1], title: "Moved check-in" };
    stored.plan_items[1] = edited;
    const added = {
      id: "user-1",
      event_date: "2026-09-10",
      title: "Mine",
      body: "",
      status: "Scheduled",
      sort_index: 9,
      created_at: "2026-09-04T10:00:00.000Z",
      updated_at: "2026-09-04T10:00:00.000Z",
    };
    stored.plan_items.push(added);

    const moved = reanchorTables(stored, buildSeed(before), buildSeed(after), 40, pk);
    const fresh = buildSeed(after);

    expect(moved.dashboard_sections).toEqual(fresh.dashboard_sections);
    expect(moved.kpi_cards).toEqual(fresh.kpi_cards);
    expect(moved.plan_items[0]).toEqual(fresh.plan_items[0]);
    expect(moved.plan_items[1]).toMatchObject({
      title: "Moved check-in",
      event_date: fresh.plan_items[1].event_date,
      created_at: fresh.plan_items[1].created_at,
    });
    expect(moved.plan_items.at(-1)).toMatchObject({ id: "user-1", event_date: "2026-10-20" });
  });
});
