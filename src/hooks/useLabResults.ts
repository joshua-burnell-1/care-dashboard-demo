// ABOUTME: Realtime-subscribed hook + save/delete helpers for the lab_results
// ABOUTME: table. Mirrors usePsaReadings so the Labs pages can merge uploaded labs.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LabResult = {
  id: string;
  date: string | null;
  metric: string;
  category: string | null;
  value_numeric: number | null;
  value_text: string | null;
  unit: string;
  reference_range: string | null;
  flag: string | null;
  source: string;
  source_document_id: string | null;
  note: string;
  sort_index: number;
  created_at: string;
  updated_at: string;
};

export function useLabResults() {
  const [items, setItems] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("lab_results")
      .select("*")
      .order("date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setItems(data ?? []);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel("lab_results_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "lab_results" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { items, loading, error, refresh };
}

export async function saveLabResult(
  password: string,
  item: Partial<LabResult> & { value?: number | string | null },
) {
  const { data, error } = await supabase.functions.invoke("dashboard-data", {
    body: { action: "upsert-lab-result", password, item },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to save");
  return data.item as LabResult;
}

export async function deleteLabResult(password: string, id: string) {
  const { data, error } = await supabase.functions.invoke("dashboard-data", {
    body: { action: "delete-lab-result", password, id },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to delete");
}
