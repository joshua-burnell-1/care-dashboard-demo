// ABOUTME: The keyless sample documents a visitor can try on the Documents page, with a
// ABOUTME: hand-written extraction for each so they work without an API key.

import type { SuggestedLab, SuggestedUpdates } from "@/components/dashboard/SuggestionsModal";

export type SampleDocument = {
  id: "lab-report" | "visit-note";
  filename: string;
  /** Path under the app's base URL, served from public/samples. */
  url: string;
  mimeType: string;
  /** What the extractor would suggest for this document, written by hand. */
  precomputed: SuggestedUpdates;
};

const PANEL_DATE = "2026-09-16";

const CBC = "Complete Blood Count (CBC)";
const CMP = "Comprehensive Metabolic Panel";

function lab(
  metric: string,
  category: string,
  value: number,
  unit: string,
  reference_range: string,
  flag: "HIGH" | "LOW" | "NORMAL",
  note = "",
): SuggestedLab {
  return { date: PANEL_DATE, metric, category, value, unit, reference_range, flag, note };
}

const LAB_REPORT_UPDATES: SuggestedUpdates = {
  psa_readings: [],
  medications: [],
  care_team: [],
  plan_items: [],
  lab_results: [
    lab("Hemoglobin", CBC, 13.3, "g/dL", "13.5–17.5", "LOW", "Slightly below the reference range."),
    lab("Hematocrit", CBC, 40.6, "%", "40–52", "NORMAL"),
    lab("Platelet Count", CBC, 238, "10³/µL", "150–400", "NORMAL"),
    lab("Glucose", CMP, 104, "mg/dL", "70–99", "HIGH", "Drawn after a 12 hour fast."),
    lab("Creatinine", CMP, 0.99, "mg/dL", "0.7–1.3", "NORMAL"),
    lab("Calcium", CMP, 9.5, "mg/dL", "8.5–10.5", "NORMAL"),
    lab("ALT", CMP, 25, "U/L", "7–55", "NORMAL"),
    lab("AST", CMP, 22, "U/L", "10–40", "NORMAL"),
    lab("Alkaline Phosphatase", CMP, 78, "U/L", "44–147", "NORMAL"),
    lab("Albumin", CMP, 4.3, "g/dL", "3.5–5.0", "NORMAL"),
    lab("Testosterone, Total", "Endocrine", 312, "ng/dL", "264–916", "NORMAL"),
  ],
};

const VISIT_NOTE_UPDATES: SuggestedUpdates = {
  psa_readings: [],
  medications: [
    {
      item: "Calcium citrate",
      dose: "500 mg twice daily with meals",
      purpose: "Bone health, taken with vitamin D3",
      started_by: "Dr. Priya Raman",
    },
  ],
  care_team: [
    {
      name: "Dana Whitaker, LCSW",
      role: "Oncology social worker",
      where_based: "Northgate University Medical Center",
      note: "Introduced for caregiver support and travel and parking on scan day",
    },
  ],
  plan_items: [
    {
      title: "Decision visit after the PSMA PET/CT report",
      body: "With Dr. Raman, within two weeks of the scan report, to go over the result and the options it points to. No treatment decisions before the scan is read.",
      event_date: null,
      status: "Conditional",
    },
  ],
  lab_results: [],
};

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: "lab-report",
    filename: "lab-report.txt",
    url: "samples/lab-report.txt",
    mimeType: "text/plain",
    precomputed: LAB_REPORT_UPDATES,
  },
  {
    id: "visit-note",
    filename: "visit-note.md",
    url: "samples/visit-note.md",
    mimeType: "text/markdown",
    precomputed: VISIT_NOTE_UPDATES,
  },
];

export function findSample(id: unknown): SampleDocument | undefined {
  return SAMPLE_DOCUMENTS.find((s) => s.id === id);
}
