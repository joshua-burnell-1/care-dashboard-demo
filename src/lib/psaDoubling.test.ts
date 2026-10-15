import { describe, it, expect } from "vitest";
import { buildSeed } from "@/demo/seed";
import { formatDoublingTime, psaDoublingMonths } from "./psaDoubling";

const pt = (date: string, value: number) => ({ date, value });

describe("psaDoublingMonths", () => {
  it("fits the whole seeded post-radiation series to the seed's ~2.5 months", () => {
    const postRad = buildSeed().psa_readings.filter((r) => r.phase === "post-rad");
    const months = psaDoublingMonths(postRad);
    expect(months).not.toBeNull();
    expect(formatDoublingTime(months!)).toBe("~2.5 mo");
  });

  it("uses every reading, not just the last two", () => {
    // Last two alone double in one month; the whole series doubles every two.
    const series = [
      pt("2026-01-01", 0.1),
      pt("2026-03-02", 0.2),
      pt("2026-04-01", 0.2),
      pt("2026-05-01", 0.4),
    ];
    expect(psaDoublingMonths(series)).toBeGreaterThan(1.5);
  });

  it("returns null with fewer than two positive readings", () => {
    expect(psaDoublingMonths([pt("2026-01-01", 0.1)])).toBeNull();
    expect(psaDoublingMonths([pt("2026-01-01", 0), pt("2026-02-01", 0.1)])).toBeNull();
  });

  it("returns null when the series is flat or falling", () => {
    expect(psaDoublingMonths([pt("2026-01-01", 0.2), pt("2026-03-01", 0.1)])).toBeNull();
    expect(psaDoublingMonths([pt("2026-01-01", 0.2), pt("2026-03-01", 0.2)])).toBeNull();
  });

  it("returns null when every reading falls on the same day", () => {
    expect(psaDoublingMonths([pt("2026-01-01", 0.1), pt("2026-01-01", 0.2)])).toBeNull();
  });

  it("returns null when readings are only milliseconds apart", () => {
    const series = [
      { date: "2026-01-01T00:00:00.000Z", value: 0.1 },
      { date: "2026-01-01T00:00:00.001Z", value: 0.2 },
    ];
    expect(psaDoublingMonths(series)).toBeNull();
  });

  it("gives the same answer however far the dates are from the epoch", () => {
    const near = psaDoublingMonths([pt("1970-01-01", 0.1), pt("1970-03-02", 0.2)]);
    const far = psaDoublingMonths([pt("2190-01-01", 0.1), pt("2190-03-02", 0.2)]);
    expect(near).not.toBeNull();
    expect(far).toBeCloseTo(near!, 6);
  });

  it("ignores readings without a value", () => {
    const series = [
      pt("2026-01-01", 0.1),
      { date: "2026-02-01", value: null },
      pt("2026-03-03", 0.2),
    ];
    expect(psaDoublingMonths(series)).toBeCloseTo(2, 0);
  });
});

describe("formatDoublingTime", () => {
  it("shows months to one decimal", () => {
    expect(formatDoublingTime(2.49)).toBe("~2.5 mo");
    expect(formatDoublingTime(1)).toBe("~1.0 mo");
  });

  it("shows anything under a month as <1 mo, never a day count", () => {
    expect(formatDoublingTime(0.5)).toBe("<1 mo");
    expect(formatDoublingTime(0.01)).toBe("<1 mo");
    expect(formatDoublingTime(0.99)).toBe("<1 mo");
  });
});
