// ABOUTME: Fictional care team and plan (timeline) items.
// ABOUTME: Plan dates are offsets from "today": one done, three upcoming.

import type { CareTeamMember } from "@/hooks/useCareTeam";
import type { PlanItem } from "@/hooks/usePlanItems";
import type { PsaReading } from "@/hooks/usePsaReadings";
import { editTimestamp, formatMonthYear, isoDaysFromToday, timestampDaysFromToday } from "../dates";
import { EDITS, PERSONA, TIMELINE } from "../persona";
import { seedId } from "./ids";

/** The plan item whose creation is recorded in the seeded edit history. */
export const PET_TITLE = "PSMA PET/CT scan";

export function buildCareTeam(today: Date): CareTeamMember[] {
  const radiationDone = formatMonthYear(isoDaysFromToday(TIMELINE.radiationEnd, today));
  const specs: Pick<
    CareTeamMember,
    "role" | "name" | "where_based" | "note" | "phone" | "email"
  >[] = [
    {
      role: "Urologic oncologist",
      name: "Dr. Priya Raman",
      where_based: PERSONA.primaryInstitution,
      note: "Performed the prostatectomy · leads PSA surveillance",
      phone: "(555) 010-0142",
      email: "priya.raman@example.com",
    },
    {
      role: "Radiation oncologist",
      name: "Dr. Samuel Okafor",
      where_based: PERSONA.radiationInstitution,
      note: `35-fraction adjuvant course to the prostate bed, completed ${radiationDone}`,
      phone: "(555) 010-0157",
      email: "samuel.okafor@example.com",
    },
    {
      role: "Primary care",
      name: "Dr. Helen Brooks",
      where_based: `${PERSONA.primaryInstitution} · Primary Care`,
      note: "Blood pressure, cholesterol and routine labs",
      phone: "(555) 010-0163",
      email: "helen.brooks@example.com",
    },
    {
      role: "Nurse navigator",
      name: "Maria Torres, RN",
      where_based: PERSONA.primaryInstitution,
      note: "First call for scheduling and day-to-day questions",
      phone: "(555) 010-0118",
      email: "maria.torres@example.com",
    },
    {
      role: "Medical oncologist (second opinion)",
      name: "Dr. James Whitfield",
      where_based: PERSONA.radiationInstitution,
      note: "Reviewing the PSA trend and systemic options if a scan finds disease",
      phone: "(555) 010-0171",
      email: "james.whitfield@example.com",
    },
  ];
  return specs.map((s, i) => ({
    ...s,
    id: seedId("team", i + 1),
    sort_index: i,
    created_at: timestampDaysFromToday(-300, today),
    updated_at:
      i === 0 ? editTimestamp(EDITS.careTeamNote, today) : timestampDaysFromToday(-20, today),
  }));
}

export function buildPlanItems(today: Date, psaReadings: PsaReading[]): PlanItem[] {
  const [previous, latest] = psaReadings.slice(-2);
  const specs: Pick<PlanItem, "event_date" | "title" | "body" | "status">[] = [
    {
      event_date: latest.date,
      title: "Ultrasensitive PSA drawn",
      body: `Result ${latest.value} ng/mL, up from ${previous.value} about a month earlier. Still under 0.20, and the PET/CT is already booked.`,
      status: "Completed",
    },
    {
      event_date: isoDaysFromToday(TIMELINE.nextVisit, today),
      title: "Pre-scan check-in with Dr. Raman",
      body: `${PERSONA.primaryInstitution}. Confirm scan preparation and the plan for reviewing the result. Bring the list of questions and any new symptoms.`,
      status: "Locked",
    },
    {
      event_date: isoDaysFromToday(TIMELINE.psmaPet, today),
      title: PET_TITLE,
      body: `${PERSONA.radiationInstitution}. Nothing to eat for 4 hours beforehand. Allow about 3 hours for the visit.`,
      status: "Scheduled",
    },
    {
      event_date: isoDaysFromToday(TIMELINE.secondOpinionFollowUp, today),
      title: "Second-opinion visit with Dr. Whitfield",
      body: "Go over the scan result and the treatment options it points to. Send the latest PSA values and the scan report ahead of time.",
      status: "Scheduled",
    },
  ];
  return specs.map((s, i) => ({
    ...s,
    id: seedId("plan", i + 1),
    sort_index: i,
    ...(s.title === PET_TITLE
      ? {
          created_at: editTimestamp(EDITS.planInsert, today),
          updated_at: editTimestamp(EDITS.planInsert, today),
        }
      : {
          created_at: timestampDaysFromToday(-30, today),
          updated_at: timestampDaysFromToday(-10, today),
        }),
  }));
}
