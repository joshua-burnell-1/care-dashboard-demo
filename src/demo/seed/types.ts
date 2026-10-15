// ABOUTME: Row types for every seeded table. Rows reuse the type exported by
// ABOUTME: the matching hook; only tables without one are defined here.

import type { PsaReading } from "@/hooks/usePsaReadings";
import type { CareTeamMember } from "@/hooks/useCareTeam";
import type { MedicationItem } from "@/hooks/useMedications";
import type { KpiCard } from "@/hooks/useKpiCards";
import type { PlanItem } from "@/hooks/usePlanItems";
import type { DashboardSection } from "@/hooks/useDashboardSections";
import type { LabResult } from "@/hooks/useLabResults";
import type { Document } from "@/hooks/useDocuments";
import type { EditHistoryEntry } from "@/hooks/useEditHistory";
import type { MedicalCacheRow } from "@/hooks/useMedicalCache";

/** `documents` row as stored for the demo: the hook's shape plus the indexed text. */
export type DocumentRow = Document & { extracted_text: string };

/** Columns of `chat_sessions` (migration 20260527000004). */
export type ChatSession = {
  id: string;
  title: string;
  created_at: string;
  last_message_at: string;
};

/** Columns of `chat_messages` (migration 20260527000004). */
export type ChatMessage = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type SeedRows = {
  psa_readings: PsaReading;
  care_team_members: CareTeamMember;
  medication_items: MedicationItem;
  kpi_cards: KpiCard;
  plan_items: PlanItem;
  dashboard_sections: DashboardSection;
  lab_results: LabResult;
  documents: DocumentRow;
  edit_history: EditHistoryEntry;
  chat_sessions: ChatSession;
  chat_messages: ChatMessage;
  medical_cache: MedicalCacheRow;
};

export type TableName = keyof SeedRows;

export type SeedData = { [T in TableName]: SeedRows[T][] };
