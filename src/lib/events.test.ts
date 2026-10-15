import { describe, it, expect } from "vitest";
import { buildSeed } from "@/demo/seed";
import { isoDaysFromToday } from "@/demo/dates";
import { TIMELINE } from "@/demo/persona";
import { treatmentEvents } from "./events";

const plan = (title: string, event_date: string | null) => ({ title, event_date });

describe("treatmentEvents", () => {
  it("marks surgery and the end of radiation from the patient section", () => {
    const events = treatmentEvents({
      patient: { surgery_date: "2025-05-01", radiation_end_date: "2025-11-20" },
      planItems: [],
    });
    expect(events).toEqual([
      { date: "2025-05-01", label: "Surgery", kind: "surgery" },
      { date: "2025-11-20", label: "Radiation ends", kind: "radiation" },
    ]);
  });

  it("classifies scans and visits from plan items, oldest first, skipping undated ones", () => {
    const events = treatmentEvents({
      patient: {},
      planItems: [
        plan("Second-opinion visit", "2026-12-14"),
        plan("PSMA PET/CT scan", "2026-11-05"),
        plan("Bone density scan (DEXA)", null),
        plan("Pre-scan check-in", "2026-10-20"),
      ],
    });
    expect(events).toEqual([
      { date: "2026-10-20", label: "Pre-scan check-in", kind: "visit" },
      { date: "2026-11-05", label: "PSMA PET/CT scan", kind: "scan" },
      { date: "2026-12-14", label: "Second-opinion visit", kind: "visit" },
    ]);
  });

  it("derives the seed's timeline", () => {
    const today = new Date(2026, 9, 15, 12);
    const s = buildSeed(today);
    const patient = s.dashboard_sections.find((r) => r.key === "patient")!.content as Record<
      string,
      string
    >;
    const events = treatmentEvents({ patient, planItems: s.plan_items });
    expect(events[0]).toEqual({
      date: isoDaysFromToday(TIMELINE.surgery, today),
      label: "Surgery",
      kind: "surgery",
    });
    expect(events.filter((e) => e.kind === "scan").map((e) => e.date)).toEqual([
      isoDaysFromToday(TIMELINE.psmaPet, today),
    ]);
  });
});
