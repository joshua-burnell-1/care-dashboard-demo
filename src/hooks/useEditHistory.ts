import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EditHistoryEntry = {
  id: string;
  table_name: string;
  record_id: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_at: string;
};

const TABLE_LABELS: Record<string, string> = {
  psa_readings: "PSA reading",
  care_team_members: "Care team",
  medication_items: "Medication",
  kpi_cards: "KPI card",
  plan_items: "Plan item",
  dashboard_sections: "Dashboard section",
};

export function tableLabel(name: string): string {
  return TABLE_LABELS[name] ?? name;
}

export function useEditHistory() {
  const [entries, setEntries] = useState<EditHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("edit_history")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(50);
    setEntries((data ?? []) as EditHistoryEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entries, loading, refresh };
}
