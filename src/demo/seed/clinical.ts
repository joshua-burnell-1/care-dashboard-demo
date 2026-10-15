// ABOUTME: Fictional clinical rows: PSA series, lab results, medications and KPI cards.
// ABOUTME: All dates are offsets from "today" so the story stays current.

import type { PsaReading } from "@/hooks/usePsaReadings";
import type { LabResult } from "@/hooks/useLabResults";
import type { MedicationItem } from "@/hooks/useMedications";
import type { KpiCard } from "./types";
import { editTimestamp, formatShortDate, isoDaysFromToday, timestampDaysFromToday } from "../dates";
import { EDITS, TIMELINE } from "../persona";
import { seedId } from "./ids";

type PsaSpec = [
  offset: number,
  value: number,
  phase: "pre-op" | "post-op" | "post-rad",
  note: string,
];

const PSA_SPECS: PsaSpec[] = [
  [-802, 3.7, "pre-op", "Annual physical baseline"],
  [-702, 5.1, "pre-op", "Rising on repeat testing"],
  [-622, 6.4, "pre-op", "Referred to urologic oncology"],
  [-572, 7.9, "pre-op", "Pre-prostatectomy baseline"],
  [-462, 0.008, "post-op", "Undetectable (<0.01) after surgery"],
  [-380, 0.008, "post-op", "Undetectable (<0.01) before radiation planning"],
  [-124, 0.04, "post-rad", "First detectable PSA since surgery"],
  [-96, 0.05, "post-rad", "Confirmed rise on a repeat draw"],
  [-68, 0.065, "post-rad", "Steady upward drift"],
  [-40, 0.085, "post-rad", "Still below 0.20"],
  [-10, 0.11, "post-rad", "Latest ultrasensitive PSA"],
];

export function buildPsaReadings(today: Date): PsaReading[] {
  return PSA_SPECS.map(([offset, value, phase, note], i) => ({
    id: seedId("psa", i + 1),
    date: isoDaysFromToday(offset, today),
    value,
    unit: "ng/mL",
    phase,
    note,
    sort_index: i,
    created_at: timestampDaysFromToday(offset, today),
    updated_at:
      i === PSA_SPECS.length - 1
        ? editTimestamp(EDITS.psaNote, today)
        : timestampDaysFromToday(offset, today),
  }));
}

const RECENT_PANEL = -10;
/** Drawn alongside the first detectable post-radiation PSA. */
const OLDER_PANEL = -124;

type LabSpec = {
  metric: string;
  category: string;
  unit: string;
  range: string;
  /** [older panel, recent panel] */
  values: [number, number];
  /** Flag for the recent panel only. */
  flag?: "HIGH" | "LOW";
  note?: string;
};

const CBC = "Complete Blood Count (CBC)";
const CMP = "Comprehensive Metabolic Panel";
const PSA_CATEGORY = "PSA (Prostate-Specific Antigen)";

const LAB_SPECS: LabSpec[] = [
  {
    metric: "White blood cells",
    category: CBC,
    unit: "10³/µL",
    range: "4.0–11.0",
    values: [6.1, 5.8],
  },
  {
    metric: "Red blood cells",
    category: CBC,
    unit: "10⁶/µL",
    range: "4.3–5.8",
    values: [4.61, 4.52],
  },
  {
    metric: "Hemoglobin",
    category: CBC,
    unit: "g/dL",
    range: "13.5–17.5",
    values: [13.8, 13.1],
    flag: "LOW",
    note: "Slightly below range. Recheck with the next draw.",
  },
  { metric: "Hematocrit", category: CBC, unit: "%", range: "40–52", values: [41.5, 40.2] },
  { metric: "Platelet Count", category: CBC, unit: "10³/µL", range: "150–400", values: [244, 231] },
  { metric: "MCV", category: CBC, unit: "fL", range: "80–100", values: [90, 89] },
  {
    metric: "Glucose",
    category: CMP,
    unit: "mg/dL",
    range: "70–99",
    values: [99, 108],
    flag: "HIGH",
    note: "Drawn fasting. Slightly above range; Dr. Brooks will recheck at the next draw.",
  },
  { metric: "Sodium", category: CMP, unit: "mmol/L", range: "135–145", values: [139, 140] },
  { metric: "Potassium", category: CMP, unit: "mmol/L", range: "3.5–5.1", values: [4.4, 4.3] },
  { metric: "BUN", category: CMP, unit: "mg/dL", range: "7–20", values: [16, 17] },
  { metric: "Creatinine", category: CMP, unit: "mg/dL", range: "0.7–1.3", values: [0.98, 1.0] },
  { metric: "eGFR", category: CMP, unit: "mL/min/1.73m²", range: "≥60", values: [84, 82] },
  { metric: "Calcium", category: CMP, unit: "mg/dL", range: "8.5–10.5", values: [9.5, 9.4] },
  { metric: "ALT", category: CMP, unit: "U/L", range: "7–55", values: [27, 24] },
];

export function buildLabResults(today: Date): LabResult[] {
  const rows: Omit<LabResult, "id" | "sort_index">[] = [];
  const base = (offset: number) => ({
    source: "Northgate University Medical Center Lab",
    source_document_id: null,
    created_at: timestampDaysFromToday(offset, today),
    updated_at: timestampDaysFromToday(offset, today),
  });

  for (const [panelIndex, offset] of [OLDER_PANEL, RECENT_PANEL].entries()) {
    for (const spec of LAB_SPECS) {
      const recent = panelIndex === 1;
      rows.push({
        date: isoDaysFromToday(offset, today),
        metric: spec.metric,
        category: spec.category,
        value_numeric: spec.values[panelIndex],
        value_text: null,
        unit: spec.unit,
        reference_range: spec.range,
        flag: recent && spec.flag ? spec.flag : null,
        note: recent && spec.note ? spec.note : "",
        ...base(offset),
      });
    }
  }

  const postRad = PSA_SPECS.filter(([, , phase]) => phase === "post-rad");
  for (const [offset, value] of postRad) {
    rows.push({
      date: isoDaysFromToday(offset, today),
      metric: "PSA Total",
      category: PSA_CATEGORY,
      value_numeric: value,
      value_text: null,
      unit: "ng/mL",
      reference_range: "<0.10 after treatment",
      flag: null,
      note: "",
      ...base(offset),
      source: "Riverside Cancer Institute Lab (ultrasensitive assay)",
    });
  }

  return rows.map((r, i) => ({ ...r, id: seedId("lab", i + 1), sort_index: i }));
}

type MedicationSpec = [item: string, dose: string, purpose: string, startedBy: string];

const MEDICATION_SPECS: MedicationSpec[] = [
  ["Vitamin D3", "2,000 IU once daily", "Bone health during follow-up", "Dr. Helen Brooks"],
  ["Atorvastatin", "20 mg once daily", "Cholesterol", "Dr. Helen Brooks"],
  ["Lisinopril", "10 mg once daily", "Blood pressure", "Dr. Helen Brooks"],
  ["Omega-3 fish oil", "1,000 mg once daily with a meal", "Heart health", "Dr. Priya Raman"],
  [
    "Psyllium fiber",
    "1 tablespoon daily in water",
    "Regular bowel habits during follow-up",
    "Dr. Samuel Okafor",
  ],
];

export function buildMedications(today: Date): MedicationItem[] {
  return MEDICATION_SPECS.map(([item, dose, purpose, started_by], i) => ({
    id: seedId("medication", i + 1),
    item,
    dose,
    purpose,
    started_by,
    sort_index: i,
    created_at: timestampDaysFromToday(-200, today),
    updated_at:
      i === 0 ? editTimestamp(EDITS.vitaminDDose, today) : timestampDaysFromToday(-200, today),
  }));
}

export function buildKpiCards(today: Date, psaReadings: PsaReading[]): KpiCard[] {
  const latest = [...psaReadings].reverse().find((r) => r.value !== null)!;
  const nextVisit = isoDaysFromToday(TIMELINE.nextVisit, today);
  const specs: Pick<KpiCard, "label" | "value" | "sub" | "tone">[] = [
    {
      label: "Latest PSA",
      value: String(latest.value),
      sub: `${formatShortDate(latest.date)} · ng/mL`,
      tone: "rose",
    },
    {
      label: "Doubling time",
      value: "~2.5 mo",
      sub: "5 post-rad PSAs · steady climb",
      tone: "rose",
    },
    {
      label: "Next appointment",
      value: formatShortDate(nextVisit),
      sub: `${TIMELINE.nextVisit} days away`,
      tone: "info",
    },
    {
      label: "Scan ready?",
      value: "Almost",
      sub: `${latest.value} vs 0.20 readiness line`,
      tone: "warn",
    },
  ];
  return specs.map((s, i) => ({
    ...s,
    id: seedId("kpi", i + 1),
    sort_index: i,
    created_at: timestampDaysFromToday(-200, today),
    updated_at: timestampDaysFromToday(-10, today),
  }));
}
