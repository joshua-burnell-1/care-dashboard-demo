// ABOUTME: Types, tone classes and a loader for the live dashboard_sections content the pages
// ABOUTME: render (summary, opinions, decision tree, nutrition, glossary and so on).
import { useAllDashboardSections } from "@/hooks/useDashboardSections";

export type Tone = "rose" | "info" | "warn" | "neutral" | "ok" | "danger";

/** Shape of the `patient` dashboard section. Every field is optional until it loads. */
export type PatientSection = {
  name?: string;
  first_name?: string;
  diagnosis?: string;
  status?: string;
  surgery_date?: string;
  radiation_end_date?: string;
};

export type DoctorOpinion = {
  pillTone: "rose" | "info";
  pillLabel: string;
  name: string;
  meta: string;
  quote: string;
  rows: { k: string; v: string }[];
};
export type TitledItem = { title: string; body: string };
/** One question the family wants to ask, tied to the plan item (visit) it is for. */
export type OpenQuestion = { id: string; text: string; visit_id: string };
export type NutritionItem = {
  name: string;
  category?: "food" | "drink";
  goal: string;
  why: string;
};
export type AvoidItem = { name: string; category?: "food" | "drink"; body: string };

export const toneClasses: Record<string, string> = {
  rose: "text-rose-700",
  warn: "text-amber-700",
  info: "text-blue-800",
  ok: "text-emerald-700",
  neutral: "text-stone-600",
  danger: "text-rose-700",
};

export const pillClasses: Record<string, string> = {
  rose: "bg-rose-100 text-rose-800",
  info: "bg-blue-100 text-blue-800",
  warn: "bg-amber-100 text-amber-800",
  neutral: "bg-stone-100 text-stone-700",
  ok: "bg-emerald-100 text-emerald-800",
};

/**
 * Live dashboard sections. Until a section loads (or if it is missing) it reads as `empty`:
 * there is no static fallback, so a real deployment never shows the demo's fictional content.
 */
export function useSections(keys: string[]) {
  const { sections, loading } = useAllDashboardSections(keys);
  const sec = <T>(key: string, empty: T): T =>
    sections[key] != null ? (sections[key] as T) : empty;
  return { sections, sec, loading };
}
