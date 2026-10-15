import { describe, it, expect } from "vitest";
import { canonicalMetricKey, canonicalMetricLabel } from "./normalizeMetric";

describe("canonicalMetricKey", () => {
  it("groups the seed's plain-English lab labels with their standard keys", () => {
    expect(canonicalMetricKey("White blood cells")).toBe("wbc");
    expect(canonicalMetricKey("Red blood cells")).toBe("rbc");
    expect(canonicalMetricKey("Glucose")).toBe("glucose");
    expect(canonicalMetricKey("Glucose (fasting)")).toBe("glucose");
  });

  it("collapses total-PSA reporting variants", () => {
    expect(canonicalMetricKey("PSA, Total")).toBe("psa total");
    expect(canonicalMetricKey("Ultrasensitive PSA")).toBe("psa total");
  });

  it("leaves unknown metrics as their own normalized form", () => {
    expect(canonicalMetricKey("Ferritin")).toBe("ferritin");
    expect(canonicalMetricLabel("Ferritin")).toBe("Ferritin");
  });
});
