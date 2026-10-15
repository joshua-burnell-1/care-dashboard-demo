// ABOUTME: Canonicalizes lab metric names so variants ("MCH" / "Mean Cell
// ABOUTME: Hemoglobin", "Potassium" / "Potassium Level", "Tot Protein" /
// ABOUTME: "Total Protein") group into one metric for filters and trends.

type MetricEntry = {
  key: string; // canonical grouping key (lowercased, no punctuation)
  display: string; // preferred display label
  aliases: string[]; // alternative input names (case-insensitive)
};

// Adding a new alias: append to the aliases array of an existing entry, or add
// a new entry. Aliases are matched after lowercasing, stripping "(" ")" ",",
// and collapsing whitespace — so "PSA, Total" already matches "PSA Total".
const ENTRIES: MetricEntry[] = [
  // ── CBC — abbreviations with full names in parens ─────────────────────────
  { key: "mch", display: "MCH (Mean Cell Hemoglobin)", aliases: ["Mean Cell Hemoglobin"] },
  {
    key: "mchc",
    display: "MCHC (Mean Cell Hemoglobin Concentration)",
    aliases: ["Mean Cell Hemoglobin Concentration"],
  },
  { key: "mcv", display: "MCV (Mean Cell Volume)", aliases: ["Mean Cell Volume"] },
  { key: "mpv", display: "MPV (Mean Platelet Volume)", aliases: ["Mean Platelet Volume"] },
  {
    key: "rbc",
    display: "RBC (Red Blood Cell)",
    aliases: [
      "Red Blood Cell",
      "Red blood cells",
      "RBC (red blood cell count)",
      "Red Blood Cell Count",
    ],
  },
  {
    key: "wbc",
    display: "WBC (White Blood Cell)",
    aliases: [
      "White Blood Cell",
      "White blood cells",
      "WBC (white blood cell count)",
      "White Blood Cell Count",
    ],
  },
  {
    key: "rdw",
    display: "RDW (Red Cell Distribution Width)",
    aliases: ["Red Cell Distribution Width"],
  },
  { key: "platelet", display: "Platelet Count", aliases: ["Platelet"] },

  // ── Chemistry / electrolytes ──────────────────────────────────────────────
  { key: "potassium", display: "Potassium", aliases: ["Potassium Level"] },
  { key: "sodium", display: "Sodium", aliases: ["Sodium Level"] },
  { key: "calcium", display: "Calcium", aliases: ["Calcium Level Total", "Total Calcium"] },
  {
    key: "glucose",
    display: "Glucose",
    aliases: ["Glucose Level", "Glucose (fasting)", "Fasting Glucose"],
  },
  { key: "albumin", display: "Albumin", aliases: ["Albumin Level"] },
  { key: "total protein", display: "Total Protein", aliases: ["Tot Protein", "Protein Total"] },
  { key: "total bilirubin", display: "Total Bilirubin", aliases: ["Bilirubin Total"] },
  { key: "co2", display: "CO2 (Carbon Dioxide)", aliases: ["Carbon Dioxide"] },

  // ── Kidney / liver ────────────────────────────────────────────────────────
  { key: "bun", display: "BUN (Blood Urea Nitrogen)", aliases: ["Blood Urea Nitrogen"] },
  {
    key: "alt",
    display: "ALT (Alanine Aminotransferase)",
    aliases: ["Alanine Aminotransferase", "SGPT"],
  },
  {
    key: "ast",
    display: "AST (Aspartate Aminotransferase)",
    aliases: ["Aspartate Aminotransferase", "SGOT"],
  },
  { key: "alp", display: "ALP (Alkaline Phosphatase)", aliases: ["Alkaline Phosphatase"] },
  {
    key: "egfr",
    display: "eGFR (Estimated Glomerular Filtration Rate)",
    aliases: ["Estimated Glomerular Filtration Rate", "GFR"],
  },

  // ── Endocrine / cardio ────────────────────────────────────────────────────
  {
    key: "tsh",
    display: "TSH (Thyroid Stimulating Hormone)",
    aliases: ["Thyroid Stimulating Hormone"],
  },
  {
    key: "inr",
    display: "INR (International Normalized Ratio)",
    aliases: ["International Normalized Ratio"],
  },
  { key: "hba1c", display: "HbA1c (Hemoglobin A1c)", aliases: ["Hemoglobin A1c", "A1c"] },

  // ── PSA variants — keep the three measurements distinct ───────────────────
  // "PSA Total" collapses common lab-reporting labels for the total-PSA value.
  {
    key: "psa total",
    display: "PSA Total",
    aliases: [
      "PSA, Total",
      "Total PSA",
      "PSA, Post-Prostatectomy",
      "PSA Post-Prostatectomy",
      "PSA Ultra Sensitive",
      "PSA Ultrasensitive",
      "Ultrasensitive PSA",
    ],
  },
  { key: "psa free", display: "PSA Free", aliases: ["Free PSA"] },
  { key: "psa percent", display: "PSA %", aliases: ["% Free PSA", "PSA % Free", "Free PSA Ratio"] },
];

function normalizeInput(s: string): string {
  return s.toLowerCase().trim().replace(/[,()]/g, " ").replace(/\s+/g, " ");
}

const ALIAS_LOOKUP = new Map<string, MetricEntry>();
const KEY_LOOKUP = new Map<string, MetricEntry>();
for (const e of ENTRIES) {
  KEY_LOOKUP.set(e.key, e);
  ALIAS_LOOKUP.set(normalizeInput(e.display), e);
  ALIAS_LOOKUP.set(normalizeInput(e.key), e);
  for (const a of e.aliases) ALIAS_LOOKUP.set(normalizeInput(a), e);
}

// Canonical key used to group / dedupe / filter rows. Unknown metrics fall back
// to their own normalized form so nothing is silently merged.
export function canonicalMetricKey(name?: string): string {
  if (!name) return "";
  const norm = normalizeInput(name);
  return ALIAS_LOOKUP.get(norm)?.key ?? norm;
}

// Preferred display label. Unknown metrics render as the original name.
export function canonicalMetricLabel(name?: string): string {
  if (!name) return "";
  const norm = normalizeInput(name);
  return ALIAS_LOOKUP.get(norm)?.display ?? name;
}
