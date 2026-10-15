// ABOUTME: The single fictional patient the whole demo is built around.
// ABOUTME: Every name, institution and timeline anchor in the seed comes from here.

export const PERSONA = {
  fullName: "Raymond Ellis",
  firstName: "Raymond",
  age: 67,
  household: "the Ellis family",
  primaryInstitution: "Northgate University Medical Center",
  radiationInstitution: "Riverside Cancer Institute",
} as const;

/** Days relative to today. Negative is the past. */
export const TIMELINE = {
  mri: -612,
  biopsy: -594,
  preOpPet: -562,
  surgery: -522,
  radiationStart: -357,
  radiationEnd: -309,
  secondOpinionVisit: -8,
  urologyVisit: -6,
  nextVisit: 5,
  psmaPet: 21,
  secondOpinionFollowUp: 60,
} as const;

/** When the seeded edit-history rows happened. Rows and history share these so their timestamps agree. */
export const EDITS = {
  psaNote: { offset: -9, time: "16:45:00" },
  planInsert: { offset: -5, time: "15:20:00" },
  vitaminDDose: { offset: -4, time: "10:05:00" },
  careTeamNote: { offset: -3, time: "11:30:00" },
  summary: { offset: -2, time: "08:40:00" },
} as const;
