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

// Table names live with the change feed, which runs in unit tests without the client.
export { tableLabel } from "@/lib/changes";

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
