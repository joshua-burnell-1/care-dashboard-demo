import { describe, expect, it } from "vitest";
import type { PlanItem } from "@/hooks/usePlanItems";
import {
  comparisonRows,
  dateBadge,
  isOverdue,
  parseClinicianMeta,
  planChip,
  splitTimeline,
} from "./plan";

const item = (over: Partial<PlanItem>): PlanItem => ({
  id: "x",
  event_date: "2026-11-01",
  title: "Visit",
  body: "",
  status: "Scheduled",
  sort_index: 0,
  created_at: "",
  updated_at: "",
  ...over,
});

const TODAY = "2026-10-15";

describe("isOverdue", () => {
  it("is true only for a dated Scheduled or In flight item before today", () => {
    expect(isOverdue(item({ event_date: "2026-10-14" }), TODAY)).toBe(true);
    expect(isOverdue(item({ event_date: "2026-10-14", status: "In flight" }), TODAY)).toBe(true);
    expect(isOverdue(item({ event_date: "2026-10-15" }), TODAY)).toBe(false);
    expect(isOverdue(item({ event_date: "2026-10-14", status: "Completed" }), TODAY)).toBe(false);
    expect(isOverdue(item({ event_date: "2026-10-14", status: "Locked" }), TODAY)).toBe(false);
    expect(isOverdue(item({ event_date: null }), TODAY)).toBe(false);
  });
});

describe("splitTimeline", () => {
  it("buckets items into overdue, upcoming, ongoing and past", () => {
    const items = [
      item({ id: "late", event_date: "2026-10-01" }),
      item({ id: "soon", event_date: "2026-10-20" }),
      item({ id: "later", event_date: "2026-12-01" }),
      item({ id: "today", event_date: TODAY }),
      item({ id: "ongoing", event_date: null, status: "Daily" }),
      item({ id: "done-old", event_date: "2026-08-01", status: "Completed" }),
      item({ id: "done-new", event_date: "2026-10-05", status: "Completed" }),
      item({ id: "done-undated", event_date: null, status: "Completed" }),
    ];
    const out = splitTimeline(items, TODAY);
    expect(out.overdue.map((i) => i.id)).toEqual(["late"]);
    expect(out.upcoming.map((i) => i.id)).toEqual(["today", "soon", "later"]);
    expect(out.ongoing.map((i) => i.id)).toEqual(["ongoing"]);
    expect(out.past.map((i) => i.id)).toEqual(["done-new", "done-old", "done-undated"]);
  });

  it("keeps a dated item with a past date but a non-overdue status in upcoming", () => {
    const out = splitTimeline(
      [item({ id: "held", event_date: "2026-09-01", status: "Hold" })],
      TODAY,
    );
    expect(out.upcoming.map((i) => i.id)).toEqual(["held"]);
    expect(out.overdue).toEqual([]);
  });

  it("does not mutate its input and handles an empty list", () => {
    const items = [
      item({ id: "b", event_date: "2026-11-02" }),
      item({ id: "a", event_date: "2026-11-01" }),
    ];
    splitTimeline(items, TODAY);
    expect(items.map((i) => i.id)).toEqual(["b", "a"]);
    expect(splitTimeline([], TODAY)).toEqual({ overdue: [], upcoming: [], ongoing: [], past: [] });
  });
});

describe("planChip", () => {
  it("names the status in words and maps it to a chip level", () => {
    expect(planChip(item({ status: "Scheduled" }), false)).toEqual({
      level: "neutral",
      label: "Scheduled",
    });
    expect(planChip(item({ status: "In flight" }), false)).toEqual({
      level: "watch",
      label: "In flight",
    });
    expect(planChip(item({ status: "Completed" }), false)).toEqual({
      level: "stable",
      label: "Completed",
    });
    expect(planChip(item({ status: "Scheduled" }), true)).toEqual({
      level: "act",
      label: "Overdue",
    });
  });
});

describe("dateBadge", () => {
  it("splits a date into month, day and year from the one date format", () => {
    expect(dateBadge("2026-10-29")).toEqual({ month: "Oct", day: "29", year: "2026" });
    expect(dateBadge("2026-02-07")).toEqual({ month: "Feb", day: "7", year: "2026" });
  });
  it("returns null for an unreadable date", () => {
    expect(dateBadge("")).toBeNull();
  });
});

describe("parseClinicianMeta", () => {
  it("splits institution, date and role, formatting the date", () => {
    expect(
      parseClinicianMeta(
        "Riverside Clinic · October 29, 2026 · medical oncologist (second opinion)",
      ),
    ).toEqual({
      institution: "Riverside Clinic",
      date: "Oct 29, 2026",
      role: "medical oncologist (second opinion)",
    });
  });
  it("falls back to the whole string as the institution", () => {
    expect(parseClinicianMeta("Somewhere")).toEqual({
      institution: "Somewhere",
      date: null,
      role: null,
    });
  });
});

describe("comparisonRows", () => {
  const a = {
    name: "A",
    rows: [
      { k: "Next step", v: "scan" },
      { k: "Worry", v: "side effects" },
    ],
  };
  const b = {
    name: "B",
    rows: [
      { k: "Worry", v: "delay" },
      { k: "Next step", v: "trial" },
    ],
  };
  it("aligns each clinician's answer under the same topic", () => {
    expect(comparisonRows([a, b])).toEqual([
      { topic: "Next step", views: ["scan", "trial"] },
      { topic: "Worry", views: ["side effects", "delay"] },
    ]);
  });
  it("leaves a gap as null when a clinician has no answer for a topic", () => {
    expect(comparisonRows([a, { name: "B", rows: [{ k: "Worry", v: "delay" }] }])[0]).toEqual({
      topic: "Next step",
      views: ["scan", null],
    });
  });

  it("treats gendered topic wording as one topic", () => {
    const rows = comparisonRows([
      { rows: [{ k: "What would change her plan", v: "x" }] },
      { rows: [{ k: "What would change his plan", v: "y" }] },
    ]);
    expect(rows).toEqual([{ topic: "What would change their plan", views: ["x", "y"] }]);
  });
});
