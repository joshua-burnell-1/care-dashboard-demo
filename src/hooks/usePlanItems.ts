import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlanItem = {
  id: string;
  event_date: string | null;
  title: string;
  body: string;
  status: string;
  sort_index: number;
  created_at: string;
  updated_at: string;
};

export function usePlanItems() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("plan_items")
      .select("*")
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("sort_index", { ascending: true });
    if (error) setError(error.message);
    else setItems(data ?? []);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel("plan_items_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_items" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { items, loading, error, refresh };
}

export async function savePlanItem(password: string, item: Partial<PlanItem>) {
  const { data, error } = await supabase.functions.invoke("plan-items", {
    body: { action: "upsert", password, item },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to save");
  return data.item as PlanItem;
}

export async function deletePlanItem(password: string, id: string) {
  const { data, error } = await supabase.functions.invoke("plan-items", {
    body: { action: "delete", password, id },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to delete");
}
