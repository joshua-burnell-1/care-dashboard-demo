import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CareTeamMember = {
  id: string;
  role: string;
  name: string;
  where_based: string;
  note: string;
  sort_index: number;
  created_at: string;
  updated_at: string;
};

export function useCareTeam() {
  const [items, setItems] = useState<CareTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("care_team_members")
      .select("*")
      .order("sort_index", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setItems(data ?? []);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel("care_team_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "care_team_members" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { items, loading, error, refresh };
}

export async function saveCareTeamMember(password: string, item: Partial<CareTeamMember>) {
  const { data, error } = await supabase.functions.invoke("dashboard-data", {
    body: { action: "upsert-care-team", password, item },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to save");
  return data.item as CareTeamMember;
}

export async function deleteCareTeamMember(password: string, id: string) {
  const { data, error } = await supabase.functions.invoke("dashboard-data", {
    body: { action: "delete-care-team", password, id },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to delete");
}
