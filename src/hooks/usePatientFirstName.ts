// ABOUTME: The patient's first name for UI copy, read once from the `patient` dashboard
// ABOUTME: section. Shows the fallback (persona in demo, "the patient" otherwise) until loaded.
import { useEffect, useState } from "react";
import { supabase, demoDb } from "@/integrations/supabase/client";
import { resolvePatientFirstName } from "@/lib/patientName";

export function usePatientFirstName(): string {
  const demo = demoDb !== null;
  const [section, setSection] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("dashboard_sections")
      .select("content")
      .eq("key", "patient")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setSection(data?.content ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return resolvePatientFirstName(section, demo);
}
