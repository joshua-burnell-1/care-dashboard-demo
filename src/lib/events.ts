// ABOUTME: Treatment milestones for the PSA chart's markers: surgery and the end of radiation from
// ABOUTME: the patient section, and scans and visits from the dated plan items.
import type { PatientSection } from "@/features/shared/sections";

export type TreatmentEventKind = "surgery" | "radiation" | "scan" | "visit";

export type TreatmentEvent = { date: string; label: string; kind: TreatmentEventKind };

// "Pre-scan check-in" is a visit, not a scan.
const SCAN = /(?<!pre-)\bscan\b|\b(PET|CT|MRI|DEXA|imaging)\b/i;

export function treatmentEvents(data: {
  patient: Pick<PatientSection, "surgery_date" | "radiation_end_date">;
  planItems: { title: string; event_date: string | null }[];
}): TreatmentEvent[] {
  const events: TreatmentEvent[] = [];
  const { surgery_date, radiation_end_date } = data.patient;
  if (surgery_date) events.push({ date: surgery_date, label: "Surgery", kind: "surgery" });
  if (radiation_end_date) {
    events.push({ date: radiation_end_date, label: "Radiation ends", kind: "radiation" });
  }
  for (const item of data.planItems) {
    if (!item.event_date) continue;
    events.push({
      date: item.event_date,
      label: item.title,
      kind: SCAN.test(item.title) ? "scan" : "visit",
    });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}
