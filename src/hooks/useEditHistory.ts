// ABOUTME: The edit history log, newest first, refreshed whenever an audited table changes.
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

/** The tables whose writes the edit-history triggers log. */
const AUDITED_TABLES = [
  "psa_readings",
  "care_team_members",
  "medication_items",
  "kpi_cards",
  "plan_items",
  "dashboard_sections",
];

/** The newest `limit` entries; `refresh` resolves to the fresh list. */
export function useEditHistory(limit = 50) {
  const [entries, setEntries] = useState<EditHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("edit_history")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(limit);
    const fresh = (data ?? []) as EditHistoryEntry[];
    setEntries(fresh);
    setLoading(false);
    return fresh;
  }, [limit]);

  useEffect(() => {
    void refresh();
    // A write to any audited table adds a log row, so listen to those tables.
    const channel = supabase.channel(`edit_history_${Math.random().toString(36).slice(2)}`);
    for (const table of AUDITED_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => void refresh());
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { entries, loading, refresh };
}
