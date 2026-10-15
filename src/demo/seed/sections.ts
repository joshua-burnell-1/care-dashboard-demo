// ABOUTME: The dashboard_sections rows: 12 structured content sections plus the
// ABOUTME: long-form patient record (patient_record_md) the chat assistant reads.

import type { DashboardSection } from "@/hooks/useDashboardSections";
import type { PsaReading } from "@/hooks/usePsaReadings";
import type { LabResult } from "@/hooks/useLabResults";
import type { CareTeamMember } from "@/hooks/useCareTeam";
import type { PlanItem } from "@/hooks/usePlanItems";
import type { MedicationItem } from "@/hooks/useMedications";
import { formatLongDate, formatMonthYear, isoDaysFromToday, editTimestamp } from "../dates";
import type { OpenQuestion } from "@/features/shared/sections";
import { EDITS, PERSONA, TIMELINE } from "../persona";
import { buildPatientRecord } from "./patientRecord";
import { PET_TITLE } from "./team";
import { FAST_DOUBLING_MONTHS } from "@/lib/status";

type Tone = "rose" | "info" | "warn" | "neutral" | "ok" | "danger";
/** The Learn page lists foods and drinks separately. */
type NutritionCategory = "food" | "drink";

export type SectionInputs = {
  psaReadings: PsaReading[];
  labResults: LabResult[];
  careTeam: CareTeamMember[];
  planItems: PlanItem[];
  medications: MedicationItem[];
};

function patientSection(today: Date) {
  return {
    name: PERSONA.fullName,
    first_name: PERSONA.firstName,
    diagnosis: "Prostate cancer",
    status: "Prostatectomy, then adjuvant radiation · PSA creeping up, PET/CT pending",
    updated: formatLongDate(isoDaysFromToday(-2, today)),
    surgery_date: isoDaysFromToday(TIMELINE.surgery, today),
    radiation_end_date: isoDaysFromToday(TIMELINE.radiationEnd, today),
  };
}

function summarySection(today: Date, psaReadings: PsaReading[]): string[] {
  const surgery = formatMonthYear(isoDaysFromToday(TIMELINE.surgery, today));
  const radiation = formatMonthYear(isoDaysFromToday(TIMELINE.radiationEnd, today));
  const postRad = psaReadings.filter((r) => r.phase === "post-rad").map((r) => r.value);
  const [first, ...rest] = postRad;
  const latest = rest.pop();
  return [
    `Surgery came first for ${PERSONA.firstName}, in ${surgery}: the prostate was removed, and the pathology report showed a few higher-risk features. A 35-session radiation course to the prostate bed followed and was completed in ${radiation}. For about six months after that the PSA could not be detected. It then returned at ${first} and has risen with every draw since (${rest.join(", ")}, then ${latest} most recently). The values are very small; the pace, a doubling roughly every two and a half months, is what the team is weighing.`,
    `Nobody knows yet where the PSA is coming from. A PSMA PET/CT is booked, and the two specialists agree on that much. They part ways on what to do alongside it: one would hold all drug treatment until the scan is read, the other would like to line up an early-treatment trial now. Nothing has to be decided this week. Right now the useful work is keeping appointments, making sure every draw goes to the same lab, and writing questions down.`,
  ];
}

function doctorsSection(today: Date) {
  const raman = formatLongDate(isoDaysFromToday(TIMELINE.urologyVisit, today));
  const whitfield = formatLongDate(isoDaysFromToday(TIMELINE.secondOpinionVisit, today));
  const scan = formatLongDate(isoDaysFromToday(TIMELINE.psmaPet, today));
  return [
    {
      pillTone: "info" as const,
      pillLabel: "Image first, hold treatment",
      name: "Dr. Priya Raman",
      meta: `${PERSONA.primaryInstitution} · ${raman} · urologic oncologist`,
      quote:
        "A scan that finds one lesion changes the whole conversation. I want that in hand before we commit him to years of side effects.",
      rows: [
        {
          k: "Preferred next step",
          v: `PSMA PET/CT on ${scan}, then a decision visit within two weeks of the report.`,
        },
        {
          k: "Hormone therapy",
          v: "Hold until the scan is read, unless the PSA starts rising faster than it has.",
        },
        {
          k: "Trial enrollment",
          v: "Open to it, but wants the scan result to decide which trial actually fits.",
        },
        {
          k: "Main worry",
          v: "Putting him on long-term hormone therapy when a targeted treatment might have been enough.",
        },
        {
          k: "What would change her plan",
          v: "A PSA of 0.30 or higher before the scan, or any symptom from the red-flag list.",
        },
        {
          k: "Side effects to avoid",
          v: "Bone thinning, hot flashes and fatigue while he is still walking every day.",
        },
      ],
    },
    {
      pillTone: "rose" as const,
      pillLabel: "Start early, through a trial",
      name: "Dr. James Whitfield",
      meta: `${PERSONA.radiationInstitution} · ${whitfield} · medical oncologist (second opinion)`,
      quote:
        "With a PSA that doubles about every eleven weeks, waiting is a decision too. I would rather open the door to a trial now than learn in the spring that the slot is gone.",
      rows: [
        {
          k: "Preferred next step",
          v: "Begin trial screening this month, in parallel with the scan.",
        },
        {
          k: "Hormone therapy",
          v: "Would start a defined course early if screening confirms eligibility, even if the scan comes back clear.",
        },
        {
          k: "Trial enrollment",
          v: "Yes. Riverside has one open for rising PSA after radiation, with an early-start arm.",
        },
        {
          k: "Main worry",
          v: "Losing months of benefit while the PSA keeps doubling.",
        },
        {
          k: "What would change his plan",
          v: "A scan showing a single treatable lesion. He would then lean toward targeted treatment first.",
        },
        {
          k: "Side effects to avoid",
          v: "Heart and metabolic effects. Wants blood pressure and cholesterol tighter before any start.",
        },
      ],
    },
  ];
}

const AGREEMENTS = [
  "The PSMA PET/CT is the right next test, and it should not be pushed back.",
  "Neither will recommend a specific drug until the PET report has been read, even if a trial slot is held open.",
  "A bone density scan should be done before any hormone therapy, so bone protection can start at the same time.",
  "Blood pressure and cholesterol need to be well controlled before hormone therapy, because it strains the heart and metabolism.",
  "Maria Torres, RN, should be the single point of contact for results, so nothing gets lost between two hospitals.",
];

const DISAGREEMENTS = [
  {
    title: "Early start if the scan is clear?",
    body: "Dr. Whitfield would begin an early course if the trial accepts him, even with a clear scan. Dr. Raman would wait, because a scan that finds one lesion may allow a much lighter treatment.",
  },
  {
    title: "Trial now, or keep it in reserve?",
    body: "Dr. Whitfield wants screening to start immediately so no slot is lost. Dr. Raman is happy to refer later, once the scan shows which kind of trial fits.",
  },
  {
    title: "How much a clear scan would settle.",
    body: "Dr. Raman would read a clear scan as permission to keep watching. Dr. Whitfield would read the same result as a limit of the scanner, not good news, and still favor starting.",
  },
];

const RED_FLAGS = [
  {
    title: "Go to the emergency department now: new leg weakness or numbness",
    body: "Especially with trouble controlling the bladder or bowels, or numbness around the groin. Pressure on the spinal cord is rare but must be treated within hours.",
  },
  {
    title: "Go to the emergency department now: cannot pass urine at all",
    body: "Several hours with no urine despite a full bladder and pain or pressure.",
  },
  {
    title: "Go to the emergency department now: sudden chest pain or breathlessness",
    body: "Or one leg that becomes swollen, red and painful. Blood clots are a known risk after cancer surgery.",
  },
  {
    title: "Call the care team the same day: fever of 100.4°F or higher",
    body: "Without an obvious cause such as a cold. Tell them about any recent procedure or scan.",
  },
  {
    title: "Call the care team the same day: bone pain that is new and does not settle",
    body: "Back, hip, rib or pelvic pain that is worse at night or does not change with movement.",
  },
  {
    title: "Call the care team the same day: blood or clots in the urine",
    body: "Even once. Note how long it lasted and whether he felt any pain.",
  },
  {
    title: "Mention at the next visit: tiredness that does not lift",
    body: "More than a couple of weeks, and out of proportion to what he is doing.",
  },
  {
    title: "Mention at the next visit: weight dropping without trying",
    body: "About 5 lb or more over a month.",
  },
  {
    title: "Mention at the next visit: swelling in the legs or lower belly",
    body: "Note which side, and whether it is worse by the end of the day.",
  },
];

const DECISION_TREE = [
  {
    q: "If the PET/CT lights up one to three pelvic lymph nodes",
    a: "Targeted radiation to those nodes, usually with a six-month course of hormone therapy. This is the outcome with the most precise options.",
  },
  {
    q: "If the PET/CT shows activity only at the old surgical site",
    a: "Because that area has already had radiation, options are narrower. Expect a discussion of a focused extra dose or a hormone-based plan, led by Dr. Okafor and Dr. Raman together.",
  },
  {
    q: "If the PET/CT shows spots in bone or outside the pelvis",
    a: "The plan moves to whole-body treatment. Dr. Whitfield takes the lead, and the trial discussion becomes concrete.",
  },
  {
    q: "If the PET/CT is clear",
    a: "Keep drawing PSA every eight weeks. Repeat the scan if the PSA reaches 0.30. A clear scan at this level does not rule out disease, and Dr. Whitfield may still propose an early start.",
  },
  {
    q: "If two draws in a row show a doubling time under two months",
    a: "Ask for the follow-up with Dr. Whitfield to be moved earlier, whatever the scan date.",
  },
  {
    q: "If the bone density scan shows thinning",
    a: "Start a bone-protecting medicine and calcium plan before any hormone therapy begins.",
  },
];

const NUTRITION_FOODS: { name: string; category: NutritionCategory; goal: string; why: string }[] =
  [
    {
      name: "Leafy greens",
      category: "food",
      goal: "A large handful at one or two meals a day",
      why: "Spinach, kale and chard add fiber, folate from food and potassium, which helps with the blood pressure pill.",
    },
    {
      name: "Soy foods",
      category: "food",
      goal: "Tofu, edamame or soy milk a few times a week",
      why: "A plant protein that can stand in for red meat. Whole soy foods are preferred over concentrated supplements.",
    },
    {
      name: "Lentils and chickpeas",
      category: "food",
      goal: "Most days",
      why: "Slow-digesting carbohydrate and fiber that helps with cholesterol.",
    },
    {
      name: "Oats and barley",
      category: "food",
      goal: "A bowl at breakfast or a side at dinner",
      why: "Soluble fiber is the best-documented food effect on LDL cholesterol.",
    },
    {
      name: "Sardines and mackerel",
      category: "food",
      goal: "Once or twice a week",
      why: "Small oily fish have omega-3 fats and also provide calcium when eaten with the bones.",
    },
    {
      name: "Avocado",
      category: "food",
      goal: "Half a fruit a few times a week",
      why: "Unsaturated fat in place of butter or cheese.",
    },
    {
      name: "Yogurt with live cultures",
      category: "food",
      goal: "A cup most days, unsweetened",
      why: "Calcium and protein, which matters for bones if hormone therapy starts.",
    },
    {
      name: "Pumpkin seeds",
      category: "food",
      goal: "A small handful, a few days a week",
      why: "Zinc and magnesium. A snack that is easy to keep in the car.",
    },
    {
      name: "Citrus fruit",
      category: "food",
      goal: "An orange or tangerine most days",
      why: "Vitamin C and fiber. Skip grapefruit while taking atorvastatin.",
    },
    {
      name: "Green tea",
      category: "drink",
      goal: "A cup or two, earlier in the day",
      why: "A flavorful, calorie-free swap for sugary drinks.",
    },
  ];

const NUTRITION_AVOID: { name: string; category: NutritionCategory; body: string }[] = [
  {
    name: "Sugary drinks",
    category: "drink",
    body: "Soda, sweetened tea and juice cocktails add sugar without fullness, and can undo the weight and glucose work.",
  },
  {
    name: "Cured and smoked meats",
    category: "food",
    body: "Ham, salami, smoked sausage and jerky. Keep them rare, and watch the salt.",
  },
  {
    name: "Deep-fried foods",
    category: "food",
    body: "Hard on cholesterol. Baked or air-fried versions are a fair swap.",
  },
  {
    name: "Salty packaged meals",
    category: "food",
    body: "Frozen dinners, canned soup and instant noodles can blunt the blood pressure medicine.",
  },
  {
    name: "Grapefruit and grapefruit juice",
    category: "food",
    body: "Can raise atorvastatin levels in the blood. Ask the pharmacist before it returns to the menu.",
  },
  {
    name: "Herbal prostate supplements",
    category: "food",
    body: "Saw palmetto and similar blends have no proven benefit here and can confuse PSA readings or interact with treatment. Check with the care team first.",
  },
];

function pathologySection(today: Date) {
  const surgery = formatMonthYear(isoDaysFromToday(TIMELINE.surgery, today));
  return [
    {
      title: "Gleason 3+4 = 7 (Grade Group 2), about 30% pattern 4",
      body: "Intermediate risk. Most of the tumor looked less aggressive, with a minority of higher-grade pattern.",
    },
    {
      title: "Margin focally positive, left posterolateral, 1 mm",
      body: "A microscopic edge of tumor may have remained. This is the main reason radiation to the prostate bed was recommended soon after surgery.",
    },
    {
      title: "Extraprostatic extension, focal",
      body: `The ${surgery} specimen showed cancer growing through the capsule in one small area on the left. Focal means it was limited rather than widespread.`,
    },
    {
      title: "Perineural invasion",
      body: "Cancer cells were seen alongside a small nerve. It is common in tumors that grow beyond the capsule and slightly raises the chance of recurrence.",
    },
    {
      title: "Nodes and seminal vesicles clear (pN0, 0 of 15)",
      body: "No cancer in any of the 15 lymph nodes removed, and none in the seminal vesicles or bladder neck. This is the most reassuring part of the report.",
    },
    {
      title: "Genomic classifier: high-risk range (0.71)",
      body: "A score associated with a higher chance of recurrence. It is one input among many and never a verdict on its own.",
    },
  ];
}

const GLOSSARY = [
  {
    term: "Adjuvant radiation",
    def: "Radiation given soon after surgery, while the PSA is still undetectable, to treat any cells that may have been left behind.",
  },
  {
    term: "Biochemical recurrence",
    def: "A PSA that becomes detectable again and keeps rising after treatment, before anything is visible on a scan.",
  },
  {
    term: "Ultrasensitive PSA",
    def: "A blood test that reports very low values precisely. The same lab should run every sample, since different labs vary slightly.",
  },
  {
    term: "PSA doubling time",
    def: `The time the PSA takes to double. Under ${FAST_DOUBLING_MONTHS} months is the fast group.`,
  },
  {
    term: "PSMA PET/CT",
    def: "A scan that uses a tracer attracted to prostate cancer cells. It can find deposits too small for ordinary CT or bone scans.",
  },
  {
    term: "Fraction",
    def: "One radiation session. Raymond's course was 35 fractions.",
  },
  {
    term: "Oligometastatic",
    def: "Disease in only a few spots, which can often be treated directly.",
  },
  {
    term: "Hormone therapy (ADT)",
    def: "Medicine that lowers testosterone. Common effects are hot flashes, tiredness, weight gain and thinner bones.",
  },
  {
    term: "Bone density scan (DEXA)",
    def: "A quick scan that measures bone strength. It gives a baseline before hormone therapy.",
  },
  {
    term: "Clinical trial",
    def: "A research study of a treatment. It has set eligibility rules and a defined schedule of visits.",
  },
  {
    term: "Tumor board",
    def: "A meeting where surgeons, radiation doctors, oncologists and radiologists review a case together.",
  },
  {
    term: "Nurse navigator",
    def: "A nurse who coordinates appointments, tests and questions between visits.",
  },
  {
    term: "Second opinion",
    def: "A review by a different specialist. It is routine and does not mean leaving the first team.",
  },
];

/** Questions the family has written down for the upcoming visits. */
function openQuestionsSection(today: Date, planItems: PlanItem[]): OpenQuestion[] {
  const on = (offset: number) => isoDaysFromToday(offset, today);
  const checkIn = planItems.find((p) => p.event_date === on(TIMELINE.nextVisit))!;
  const scan = planItems.find((p) => p.title === PET_TITLE)!;
  const secondOpinion = planItems.find((p) => p.event_date === on(TIMELINE.secondOpinionFollowUp))!;
  const specs: [visit: PlanItem, text: string][] = [
    [checkIn, "Should he skip the vitamin D and fish oil on the morning of the scan?"],
    [checkIn, "If the PSA reaches 0.20 before the scan, does anything change?"],
    [scan, "How soon will the report be ready, and who will call us with it?"],
    [secondOpinion, "If the trial accepts him, how often would visits at Riverside be?"],
  ];
  return specs.map(([visit, text], i) => ({ id: `question-${i + 1}`, text, visit_id: visit.id }));
}

export function buildDashboardSections(today: Date, inputs: SectionInputs): DashboardSection[] {
  const updated_at = editTimestamp(EDITS.summary, today);
  const content: Record<string, unknown> = {
    patient: patientSection(today),
    summary: summarySection(today, inputs.psaReadings),
    doctors: doctorsSection(today),
    agreements: AGREEMENTS,
    disagreements: DISAGREEMENTS,
    red_flags: RED_FLAGS,
    decision_tree: DECISION_TREE,
    nutrition_foods: NUTRITION_FOODS,
    nutrition_avoid: NUTRITION_AVOID,
    pathology_features: pathologySection(today),
    glossary: GLOSSARY,
    open_questions: openQuestionsSection(today, inputs.planItems),
  };
  content.patient_record_md = buildPatientRecord(today, inputs, {
    redFlags: RED_FLAGS,
    nutritionFoods: NUTRITION_FOODS,
    nutritionAvoid: NUTRITION_AVOID,
    glossary: GLOSSARY,
  });
  return Object.entries(content).map(([key, value]) => ({ key, content: value, updated_at }));
}
