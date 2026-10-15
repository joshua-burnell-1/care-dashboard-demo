import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type KpiCard = {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: string;
  sort_index: number;
  created_at: string;
  updated_at: string;
};

export function useKpiCards() {
  const [items, setItems] = useState<KpiCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("kpi_cards")
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
      .channel("kpi_cards_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "kpi_cards" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { items, loading, error, refresh };
}

export async function saveKpiCard(password: string, item: Partial<KpiCard>) {
  const { data, error } = await supabase.functions.invoke("dashboard-data", {
    body: { action: "upsert-kpi", password, item },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to save");
  return data.item as KpiCard;
}

export async function deleteKpiCard(password: string, id: string) {
  const { data, error } = await supabase.functions.invoke("dashboard-data", {
    body: { action: "delete-kpi", password, id },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to delete");
}
