// ABOUTME: Resolves the patient's first name for UI copy from the `patient` dashboard
// ABOUTME: section, falling back to the demo persona, or to "the patient" in real mode.
import { PERSONA } from "@/demo/persona";

export const GENERIC_PATIENT_NAME = "the patient";

export function resolvePatientFirstName(patientSection: unknown, demo: boolean): string {
  const raw =
    patientSection && typeof patientSection === "object"
      ? (patientSection as { first_name?: unknown }).first_name
      : undefined;
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name) return name;
  return demo ? PERSONA.firstName : GENERIC_PATIENT_NAME;
}
