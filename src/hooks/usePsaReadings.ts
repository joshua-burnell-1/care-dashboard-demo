import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PsaReading = {
  id: string;
  date: string;
  value: number | null;
  unit: string;
  phase: string;
  note: string;
  sort_index: number;
  created_at: string;
  updated_at: string;
};

export function usePsaReadings() {
  const [items, setItems] = useState<PsaReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("psa_readings")
      .select("*")
      .order("date", { ascending: true })
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
      .channel("psa_readings_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "psa_readings" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { items, loading, error, refresh };
}

export async function savePsaReading(password: string, item: Partial<PsaReading>) {
  const { data, error } = await supabase.functions.invoke("dashboard-data", {
    body: { action: "upsert-psa", password, item },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to save");
  return data.item as PsaReading;
}

export async function deletePsaReading(password: string, id: string) {
  const { data, error } = await supabase.functions.invoke("dashboard-data", {
    body: { action: "delete-psa", password, id },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to delete");
}
