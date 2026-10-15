// ABOUTME: Single entry point for the fictional seed dataset. Every table the
// ABOUTME: mock backend and seed.sql need comes from buildSeed().

import { buildChat, buildDocuments, buildEditHistory, buildMedicalCache } from "./activity";
import { buildKpiCards, buildLabResults, buildMedications, buildPsaReadings } from "./clinical";
import { buildDashboardSections } from "./sections";
import { buildCareTeam, buildPlanItems } from "./team";
import type { SeedData } from "./types";

export type { SeedData, TableName } from "./types";

/** Bump when the seed changes shape so stored demo databases reset. */
export const SEED_VERSION = 1;

export function buildSeed(today: Date = new Date()): SeedData {
  const psa_readings = buildPsaReadings(today);
  const lab_results = buildLabResults(today);
  const medication_items = buildMedications(today);
  const kpi_cards = buildKpiCards(today, psa_readings);
  const care_team_members = buildCareTeam(today);
  const plan_items = buildPlanItems(today, psa_readings);

  const dashboard_sections = buildDashboardSections(today, {
    psaReadings: psa_readings,
    labResults: lab_results,
    careTeam: care_team_members,
    planItems: plan_items,
    medications: medication_items,
  });
  const summary = dashboard_sections.find((s) => s.key === "summary")!.content as string[];

  const documents = buildDocuments(today, psa_readings);
  const activityInputs = {
    psaReadings: psa_readings,
    careTeam: care_team_members,
    medications: medication_items,
    planItems: plan_items,
    summary,
  };
  const chat = buildChat(today, psa_readings);

  return {
    psa_readings,
    care_team_members,
    medication_items,
    kpi_cards,
    plan_items,
    dashboard_sections,
    lab_results,
    documents,
    edit_history: buildEditHistory(today, activityInputs),
    chat_sessions: chat.sessions,
    chat_messages: chat.messages,
    medical_cache: [buildMedicalCache(today, activityInputs, documents)],
  };
}
