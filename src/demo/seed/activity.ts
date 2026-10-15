// ABOUTME: Fictional activity rows: indexed documents, edit history, one chat
// ABOUTME: conversation, and the single medical_cache row.

import type { PsaReading } from "@/hooks/usePsaReadings";
import type { CareTeamMember } from "@/hooks/useCareTeam";
import type { MedicationItem } from "@/hooks/useMedications";
import type { PlanItem } from "@/hooks/usePlanItems";
import type { EditHistoryEntry } from "@/hooks/useEditHistory";
import type { MedicalCacheRow } from "@/hooks/useMedicalCache";
import {
  formatLongDate,
  formatMonthYear,
  isoDaysFromToday,
  timestampDaysFromToday,
  editTimestamp,
  type Moment,
} from "../dates";
import { EDITS, PERSONA, TIMELINE } from "../persona";
import { seedId } from "./ids";
import { PET_TITLE } from "./team";
import type { ChatMessage, ChatSession, DocumentRow } from "./types";

export type ActivityInputs = {
  psaReadings: PsaReading[];
  careTeam: CareTeamMember[];
  medications: MedicationItem[];
  planItems: PlanItem[];
  summary: string[];
};

export function buildDocuments(today: Date, psaReadings: PsaReading[]): DocumentRow[] {
  const latest = psaReadings[psaReadings.length - 1];
  const surgery = formatLongDate(isoDaysFromToday(TIMELINE.surgery, today));
  const radStart = formatLongDate(isoDaysFromToday(TIMELINE.radiationStart, today));
  const radEnd = formatLongDate(isoDaysFromToday(TIMELINE.radiationEnd, today));
  const specs: {
    name: string;
    slug: string;
    uploadedOffset: number;
    size: number;
    text: string;
  }[] = [
    {
      name: "Surgical pathology report.pdf",
      slug: "surgical-pathology-report.pdf",
      uploadedOffset: -176,
      size: 184320,
      text: `FICTIONAL SAMPLE DOCUMENT. Patient: ${PERSONA.fullName}. Specimen: radical prostatectomy with pelvic lymph node dissection, collected ${surgery} at ${PERSONA.primaryInstitution}. Diagnosis: prostatic adenocarcinoma, Gleason 3+4 = 7 (Grade Group 2), about 30% pattern 4. Stage pT3a N0, 0 of 15 nodes involved. Focal extraprostatic extension, left. Perineural invasion present. Surgical margin focally positive at the left posterolateral edge (1 mm). Seminal vesicles negative.`,
    },
    {
      name: "Radiation treatment summary.pdf",
      slug: "radiation-treatment-summary.pdf",
      uploadedOffset: -300,
      size: 142336,
      text: `FICTIONAL SAMPLE DOCUMENT. Patient: ${PERSONA.fullName}. Treating physician: Dr. Samuel Okafor, ${PERSONA.radiationInstitution}. Course: adjuvant radiation to the prostate bed, 35 fractions, started ${radStart} and completed ${radEnd}. Treatment was well tolerated. Mild bladder irritation resolved within weeks. Follow-up: PSA every 6 to 8 weeks with Dr. Priya Raman.`,
    },
    {
      name: "Ultrasensitive PSA results.pdf",
      slug: "ultrasensitive-psa-results.pdf",
      uploadedOffset: -9,
      size: 96256,
      text: `FICTIONAL SAMPLE DOCUMENT. Patient: ${PERSONA.fullName}. Ultrasensitive PSA, collected ${formatLongDate(latest.date)}: ${latest.value} ng/mL. Prior values in sequence: ${psaReadings
        .filter((r) => r.phase === "post-rad")
        .slice(0, -1)
        .map((r) => r.value)
        .join(
          ", ",
        )} ng/mL. Reference for a patient after prostatectomy: undetectable (<0.01). Ordering physician: Dr. Priya Raman.`,
    },
  ];
  return specs.map((s, i) => ({
    id: seedId("document", i + 1),
    name: s.name,
    mime_type: "application/pdf",
    storage_path: `demo/${s.slug}`,
    size_bytes: s.size,
    uploaded_at: timestampDaysFromToday(s.uploadedOffset, today),
    status: "indexed",
    error: null,
    extracted_chars: s.text.length,
    extracted_text: s.text,
  }));
}

export function buildEditHistory(today: Date, inputs: ActivityInputs): EditHistoryEntry[] {
  const { psaReadings, careTeam, medications, planItems, summary } = inputs;
  const latestPsa = psaReadings[psaReadings.length - 1];
  const raman = careTeam[0];
  const vitaminD = medications[0];
  const upcomingScan = planItems.find((p) => p.title === PET_TITLE)!;
  const asRecord = (row: object) => ({ ...row }) as Record<string, unknown>;

  const stamp = (moment: Moment) => editTimestamp(moment, today);
  const specs: Omit<EditHistoryEntry, "id">[] = [
    {
      table_name: "plan_items",
      record_id: upcomingScan.id,
      operation: "INSERT",
      old_data: null,
      new_data: asRecord(upcomingScan),
      changed_at: stamp(EDITS.planInsert),
    },
    {
      table_name: "medication_items",
      record_id: vitaminD.id,
      operation: "UPDATE",
      old_data: asRecord({
        ...vitaminD,
        dose: "1,000 IU once daily",
        updated_at: vitaminD.created_at,
      }),
      new_data: asRecord(vitaminD),
      changed_at: stamp(EDITS.vitaminDDose),
    },
    {
      table_name: "psa_readings",
      record_id: latestPsa.id,
      operation: "UPDATE",
      old_data: asRecord({
        ...latestPsa,
        note: "Result pending",
        updated_at: latestPsa.created_at,
      }),
      new_data: asRecord(latestPsa),
      changed_at: stamp(EDITS.psaNote),
    },
    {
      table_name: "care_team_members",
      record_id: raman.id,
      operation: "UPDATE",
      old_data: asRecord({
        ...raman,
        note: "Performed the prostatectomy",
        updated_at: raman.created_at,
      }),
      new_data: asRecord(raman),
      changed_at: stamp(EDITS.careTeamNote),
    },
    {
      table_name: "dashboard_sections",
      record_id: "summary",
      operation: "UPDATE",
      old_data: asRecord({
        key: "summary",
        content: [summary[0]],
        updated_at: timestampDaysFromToday(-30, today),
      }),
      new_data: asRecord({ key: "summary", content: summary, updated_at: stamp(EDITS.summary) }),
      changed_at: stamp(EDITS.summary),
    },
  ];
  return specs
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at))
    .map((s, i) => ({ ...s, id: seedId("edit", i + 1) }));
}

export function buildChat(
  today: Date,
  psaReadings: PsaReading[],
): { sessions: ChatSession[]; messages: ChatMessage[] } {
  const latest = psaReadings[psaReadings.length - 1];
  const previous = psaReadings[psaReadings.length - 2];
  const sessionId = seedId("session", 1);
  const askedAt = timestampDaysFromToday(-3, today, "19:12:00");
  const answeredAt = timestampDaysFromToday(-3, today, "19:12:20");
  return {
    sessions: [
      {
        id: sessionId,
        title: "What does the latest PSA mean?",
        created_at: askedAt,
        last_message_at: answeredAt,
      },
    ],
    messages: [
      {
        id: seedId("message", 1),
        session_id: sessionId,
        role: "user",
        content: `His latest PSA was ${latest.value}. Is that bad? I don't really know how to read these numbers.`,
        created_at: askedAt,
      },
      {
        id: seedId("message", 2),
        session_id: sessionId,
        role: "assistant",
        content: `That is a fair question, and it is hard to know how to read these. In ${PERSONA.firstName}'s records, the most recent PSA was ${latest.value} ng/mL on ${formatLongDate(latest.date)}, up from ${previous.value} ng/mL on ${formatLongDate(previous.date)}.\n\nThe number itself is still small. What the care team is watching is the direction: it has gone up at each of the last five draws, roughly doubling every two and a half months. Dr. Raman's plan is to keep monitoring and get the PSMA PET/CT on ${formatLongDate(isoDaysFromToday(TIMELINE.psmaPet, today))} so they can see where the PSA is coming from.\n\nI can't say what it means for treatment. That is a question for Dr. Raman or Maria Torres, RN, and it is worth writing down before the next visit.`,
        created_at: answeredAt,
      },
    ],
  };
}

export function buildMedicalCache(
  today: Date,
  inputs: ActivityInputs,
  documents: DocumentRow[],
): MedicalCacheRow {
  const { psaReadings, careTeam, planItems } = inputs;
  const latest = psaReadings[psaReadings.length - 1];
  const synced = timestampDaysFromToday(-1, today, "06:00:00");
  const upcoming = planItems.filter((p) => p.status !== "Completed");
  return {
    id: 1,
    data: {
      headline: "Slowly rising PSA after surgery and adjuvant radiation. Scan pending.",
      patient_summary: `${PERSONA.fullName}, ${PERSONA.age}, is being followed at ${PERSONA.primaryInstitution} and ${PERSONA.radiationInstitution} for a rising PSA after prostatectomy (${formatMonthYear(isoDaysFromToday(TIMELINE.surgery, today))}) and adjuvant radiation.`,
      latest_psa: { value: latest.value, unit: "ng/mL", date: latest.date, note: latest.note },
      psa_history: psaReadings.map((r) => ({
        date: r.date,
        value: r.value,
        unit: r.unit,
        note: r.note,
      })),
      next_steps: upcoming.map((p) => `${formatLongDate(p.event_date!)}: ${p.title}`),
      care_team: careTeam.map((m) => ({
        role: m.role,
        name: m.name,
        where: m.where_based,
        note: m.note,
      })),
      key_updates: [
        {
          date: latest.date,
          title: "Latest ultrasensitive PSA",
          body: `${latest.value} ng/mL, below 0.20, with the PET/CT already booked.`,
        },
      ],
    },
    context: documents.map((d) => `### ${d.name}\n${d.extracted_text}`).join("\n\n"),
    sources: documents.map((d) => ({
      id: d.id,
      name: d.name,
      mimeType: d.mime_type,
      modifiedTime: d.uploaded_at,
      textChars: d.extracted_chars,
      truncated: false,
    })),
    last_synced_at: synced,
    last_error: null,
  };
}
