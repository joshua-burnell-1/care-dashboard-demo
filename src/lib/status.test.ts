import { describe, it, expect } from "vitest";
import { computeDelta, computeStatus, doublingBand, formatPsa } from "./status";

const LINE = 0.2;

describe("computeStatus", () => {
  it("acts when the latest PSA reaches the readiness line", () => {
    const s = computeStatus({ latestPsa: 0.2, doublingMonths: null, readinessLine: LINE });
    expect(s.level).toBe("act");
    expect(s.headline).toContain("0.2");
  });

  it("acts when the doubling time is under 3 months", () => {
    const s = computeStatus({ latestPsa: 0.11, doublingMonths: 2.5, readinessLine: LINE });
    expect(s.level).toBe("act");
    expect(s.lead).toBe("PSA 0.11 and rising, doubling about every 2.5 months.");
  });

  it("watches when the doubling time is between 3 and 6 months", () => {
    const s = computeStatus({ latestPsa: 0.11, doublingMonths: 4.2, readinessLine: LINE });
    expect(s.level).toBe("watch");
  });

  it("watches any rising PSA above zero, even with a slow doubling time", () => {
    const s = computeStatus({ latestPsa: 0.05, doublingMonths: 14, readinessLine: LINE });
    expect(s.level).toBe("watch");
  });

  it("is stable when the PSA is not rising", () => {
    const s = computeStatus({ latestPsa: 0.008, doublingMonths: null, readinessLine: LINE });
    expect(s.level).toBe("stable");
    expect(s.lead).toBe("PSA 0.008 and holding steady.");
  });

  it("is stable with no readings yet", () => {
    const s = computeStatus({ latestPsa: null, doublingMonths: null, readinessLine: LINE });
    expect(s.level).toBe("stable");
    expect(s.headline).toBe("No PSA results yet.");
  });

  it("ends the headline with the next step from the plan", () => {
    const s = computeStatus({
      latestPsa: 0.11,
      doublingMonths: 2.5,
      readinessLine: LINE,
      nextStep: { title: "PSMA PET/CT scan", date: "2026-11-05" },
    });
    expect(s.nextStep).toBe("Next step: PSMA PET/CT scan on Nov 5, 2026.");
    expect(s.headline).toBe(
      "PSA 0.11 and rising, doubling about every 2.5 months. Next step: PSMA PET/CT scan on Nov 5, 2026.",
    );
  });

  it("never uses an em dash", () => {
    const s = computeStatus({
      latestPsa: 0.3,
      doublingMonths: 0.5,
      readinessLine: LINE,
      nextStep: { title: "Visit", date: "2026-11-05" },
    });
    expect(s.headline).not.toContain("—");
  });
});

describe("computeDelta", () => {
  const pt = (date: string, value: number) => ({ date, value });

  it("goes up", () => {
    expect(computeDelta([pt("2026-09-05", 0.085), pt("2026-10-05", 0.11)])).toEqual({
      current: 0.11,
      previous: 0.085,
      change: 0.025,
      direction: "up",
    });
  });

  it("goes down", () => {
    const d = computeDelta([pt("2026-09-05", 0.2), pt("2026-10-05", 0.15)]);
    expect(d.direction).toBe("down");
    expect(d.change).toBe(-0.05);
  });

  it("stays flat", () => {
    const d = computeDelta([pt("2026-09-05", 0.008), pt("2026-10-05", 0.008)]);
    expect(d.direction).toBe("flat");
    expect(d.change).toBe(0);
  });

  it("has no previous value or change for a single point", () => {
    expect(computeDelta([pt("2026-10-05", 0.11)])).toEqual({
      current: 0.11,
      previous: null,
      change: null,
      direction: "flat",
    });
  });

  it("orders by date, whatever order the series arrives in", () => {
    const d = computeDelta([pt("2026-10-05", 0.11), pt("2026-09-05", 0.085)]);
    expect(d.current).toBe(0.11);
    expect(d.previous).toBe(0.085);
  });
});

describe("doublingBand", () => {
  it("maps the doubling time to the Learn page's bands", () => {
    expect(doublingBand(2.5)).toEqual({ level: "act", label: "Fast" });
    expect(doublingBand(4)).toEqual({ level: "watch", label: "Moderate" });
    expect(doublingBand(9)).toEqual({ level: "stable", label: "Slow" });
    expect(doublingBand(null)).toBeNull();
  });
});

describe("formatPsa", () => {
  it("keeps the three decimals ultrasensitive results need", () => {
    expect(formatPsa(0.085)).toBe("0.085");
    expect(formatPsa(0.11)).toBe("0.11");
    expect(formatPsa(7.9)).toBe("7.9");
  });
});
