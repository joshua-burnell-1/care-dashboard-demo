import { describe, it, expect } from "vitest";
import { buildSeed } from "@/demo/seed";
import { formatDate } from "./format";
import { dateToTime, layoutEventLabels, niceTicks, timeToIso, toTimeDomain } from "./timeDomain";

const pt = (date: string, value: number | null) => ({ date, value });

describe("toTimeDomain", () => {
  it("spaces readings by elapsed time: a 9-month gap is wider than a 1-month gap", () => {
    const { points } = toTimeDomain([
      pt("2025-01-10", 0.008),
      pt("2025-10-10", 0.04),
      pt("2025-11-10", 0.05),
    ]);
    const nineMonthGap = points[1].x - points[0].x;
    const oneMonthGap = points[2].x - points[1].x;
    expect(nineMonthGap).toBeGreaterThan(oneMonthGap);
    expect(nineMonthGap / oneMonthGap).toBeCloseTo(273 / 31, 1);
  });

  it("does the same for the seed's undetectable stretch before the PSA returned", () => {
    const post = buildSeed(new Date(2026, 9, 15, 12)).psa_readings.filter(
      (r) => r.phase !== "pre-op",
    );
    const { points } = toTimeDomain(post);
    const gaps = points.slice(1).map((p, i) => p.x - points[i].x);
    // The longest gap (post-op to the first detectable reading) dwarfs the monthly draws.
    expect(Math.max(...gaps)).toBeGreaterThan(gaps.at(-1)! * 8);
  });

  it("skips readings without a value and sorts by date", () => {
    const { points } = toTimeDomain([
      pt("2026-02-01", 0.2),
      pt("2026-01-01", null),
      pt("2025-12-01", 0.1),
    ]);
    expect(points.map((p) => p.date)).toEqual(["2025-12-01", "2026-02-01"]);
  });

  it("stretches the domain to cover event dates", () => {
    const { domain } = toTimeDomain([pt("2026-01-01", 0.1), pt("2026-03-01", 0.2)], ["2026-05-01"]);
    expect(domain[0]).toBeLessThanOrEqual(dateToTime("2026-01-01"));
    expect(domain[1]).toBeGreaterThanOrEqual(dateToTime("2026-05-01"));
  });

  it("puts month ticks inside the domain, no more than asked for", () => {
    const { domain, ticks } = toTimeDomain([pt("2027-03-09", 0.1), pt("2028-08-23", 0.2)], [], {
      maxTicks: 5,
    });
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks.length).toBeLessThanOrEqual(5);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(domain[0]);
      expect(t).toBeLessThanOrEqual(domain[1]);
      expect(timeToIso(t).endsWith("-01")).toBe(true);
    }
  });

  it("round-trips dates through timestamps without a timezone shift", () => {
    expect(timeToIso(dateToTime("2026-03-08"))).toBe("2026-03-08");
    expect(formatDate(timeToIso(dateToTime("2026-11-01")), "monthYear")).toBe("Nov 2026");
  });
});

describe("layoutEventLabels", () => {
  const domain: [number, number] = [dateToTime("2025-01-01"), dateToTime("2026-01-01")];

  it("stacks labels that would collide onto separate rows", () => {
    const rows = layoutEventLabels(
      [dateToTime("2025-03-01"), dateToTime("2025-03-10"), dateToTime("2025-09-01")],
      domain,
    ).map((l) => l.row);
    expect(rows).toEqual([0, 1, 0]);
  });

  it("anchors labels near the right edge to the end so they stay inside the chart", () => {
    const [left, right] = layoutEventLabels(
      [dateToTime("2025-02-07"), dateToTime("2025-12-22")],
      domain,
    );
    expect(left.anchor).toBe("start");
    expect(right.anchor).toBe("end");
  });
});

describe("niceTicks", () => {
  it("steps evenly from 0 past the maximum", () => {
    expect(niceTicks(0.224)).toEqual([0, 0.05, 0.1, 0.15, 0.2, 0.25]);
    expect(niceTicks(0.18)).toEqual([0, 0.05, 0.1, 0.15, 0.2]);
    expect(niceTicks(9)).toEqual([0, 2, 4, 6, 8, 10]);
  });
});
