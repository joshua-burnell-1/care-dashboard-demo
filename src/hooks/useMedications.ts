import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MedicationItem = {
  id: string;
  item: string;
  dose: string;
  purpose: string;
  started_by: string;
  sort_index: number;
  created_at: string;
  updated_at: string;
};

export function useMedications() {
  const [items, setItems] = useState<MedicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("medication_items")
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
      .channel("medication_items_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "medication_items" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { items, loading, error, refresh };
}

export async function saveMedication(password: string, item: Partial<MedicationItem>) {
  const { data, error } = await supabase.functions.invoke("dashboard-data", {
    body: { action: "upsert-medication", password, item },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to save");
  return data.item as MedicationItem;
}

export async function deleteMedication(password: string, id: string) {
  const { data, error } = await supabase.functions.invoke("dashboard-data", {
    body: { action: "delete-medication", password, id },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to delete");
}
