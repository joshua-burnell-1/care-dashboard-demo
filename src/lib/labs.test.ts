import { describe, expect, it } from "vitest";
import { labMetricSlug } from "./labs";

describe("labMetricSlug", () => {
  it("lowercases and joins words with dashes", () => {
    expect(labMetricSlug("Hemoglobin")).toBe("hemoglobin");
    expect(labMetricSlug("PSA Total")).toBe("psa-total");
  });

  it("gives variants of one metric the same slug", () => {
    expect(labMetricSlug("PSA, Total")).toBe(labMetricSlug("Total PSA"));
    expect(labMetricSlug("HbA1c (Hemoglobin A1c)")).toBe(labMetricSlug("A1c"));
  });

  it("is stable when given a display label", () => {
    expect(labMetricSlug("MCH (Mean Cell Hemoglobin)")).toBe("mch");
  });

  it("returns an empty slug for a name with no letters or digits", () => {
    expect(labMetricSlug("()")).toBe("");
  });
});
