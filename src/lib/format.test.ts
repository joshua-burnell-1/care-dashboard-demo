import { describe, it, expect } from "vitest";
import { formatDate, formatNumber, formatRelative } from "./format";

const today = new Date(2026, 9, 15);

describe("formatDate", () => {
  it("formats short by default", () => {
    expect(formatDate("2026-10-05")).toBe("Oct 5, 2026");
    expect(formatDate("2026-10-05", "short")).toBe("Oct 5, 2026");
  });
  it("formats long", () => {
    expect(formatDate("2026-10-05", "long")).toBe("October 5, 2026");
  });
  it("formats month and year", () => {
    expect(formatDate("2026-10-05", "monthYear")).toBe("Oct 2026");
  });
  it("treats date-only strings as local calendar dates (no UTC shift)", () => {
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatDate("2026-12-31", "long")).toBe("December 31, 2026");
  });
  it("accepts full ISO timestamps by their calendar date", () => {
    expect(formatDate("2026-10-05T14:30:00")).toBe("Oct 5, 2026");
  });
  it("returns an empty string for unparseable input", () => {
    expect(formatDate("not a date")).toBe("");
  });
});

describe("formatRelative", () => {
  it("says today", () => {
    expect(formatRelative("2026-10-15", today)).toBe("today");
  });
  it("counts days ahead and behind", () => {
    expect(formatRelative("2026-10-20", today)).toBe("in 5 days");
    expect(formatRelative("2026-10-12", today)).toBe("3 days ago");
  });
  it("uses tomorrow and yesterday for single days", () => {
    expect(formatRelative("2026-10-16", today)).toBe("tomorrow");
    expect(formatRelative("2026-10-14", today)).toBe("yesterday");
  });
  it("ignores the time of day of today", () => {
    expect(formatRelative("2026-10-15", new Date(2026, 9, 15, 23, 59))).toBe("today");
  });
  it("counts calendar days across a DST change", () => {
    expect(formatRelative("2026-11-02", new Date(2026, 10, 1, 12))).toBe("tomorrow");
    expect(formatRelative("2026-03-09", new Date(2026, 2, 7, 12))).toBe("in 2 days");
  });
  it("defaults today to now", () => {
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(formatRelative(iso)).toBe("today");
  });
  it("returns an empty string for unparseable input", () => {
    expect(formatRelative("nope", today)).toBe("");
  });
});

describe("formatNumber", () => {
  it("groups thousands", () => {
    expect(formatNumber(12345)).toBe("12,345");
  });
  it("pins the number of decimals when digits is given", () => {
    expect(formatNumber(4.2, 2)).toBe("4.20");
    expect(formatNumber(1234.5678, 1)).toBe("1,234.6");
    expect(formatNumber(7, 0)).toBe("7");
  });
  it("keeps up to two decimals by default", () => {
    expect(formatNumber(0.075)).toBe("0.08");
    expect(formatNumber(4.2)).toBe("4.2");
  });
});
