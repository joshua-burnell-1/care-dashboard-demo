import { describe, expect, it } from "vitest";
import { DOUBLING_BAND_ROWS, doublingRangeLabel } from "./doublingBands";
import { FAST_DOUBLING_MONTHS, MODERATE_DOUBLING_MONTHS, doublingBand } from "./status";

describe("Learn's doubling-time bands", () => {
  it("run fast, moderate, slow and cover every month without a gap", () => {
    expect(DOUBLING_BAND_ROWS.map((r) => r.label)).toEqual(["Fast", "Moderate", "Slow"]);
    expect(DOUBLING_BAND_ROWS[0].min).toBe(0);
    for (let i = 1; i < DOUBLING_BAND_ROWS.length; i++) {
      expect(DOUBLING_BAND_ROWS[i].min).toBe(DOUBLING_BAND_ROWS[i - 1].max);
    }
    expect(DOUBLING_BAND_ROWS.at(-1)!.max).toBe(Infinity);
  });

  it("match doublingBand just inside and exactly at each boundary", () => {
    for (const row of DOUBLING_BAND_ROWS) {
      for (const months of [
        row.min,
        row.min + 0.001,
        Number.isFinite(row.max) ? row.max - 0.001 : 60,
      ]) {
        expect(doublingBand(months)).toEqual({ level: row.level, label: row.label });
      }
    }
  });

  it("take their numbers from the status constants", () => {
    expect(DOUBLING_BAND_ROWS[0].max).toBe(FAST_DOUBLING_MONTHS);
    expect(DOUBLING_BAND_ROWS[1].max).toBe(MODERATE_DOUBLING_MONTHS);
    const ranges = DOUBLING_BAND_ROWS.map(doublingRangeLabel);
    expect(ranges).toEqual([
      `Under ${FAST_DOUBLING_MONTHS} months`,
      `${FAST_DOUBLING_MONTHS} to ${MODERATE_DOUBLING_MONTHS} months`,
      `Over ${MODERATE_DOUBLING_MONTHS} months`,
    ]);
  });

  it("never uses an em dash", () => {
    expect(JSON.stringify(DOUBLING_BAND_ROWS)).not.toMatch(/\u2014/);
  });
});
