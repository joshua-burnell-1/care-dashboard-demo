import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DashboardSection = {
  key: string;
  content: unknown;
  updated_at: string;
};

export function useDashboardSection(key: string) {
  const [content, setContent] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("dashboard_sections")
      .select("*")
      .eq("key", key)
      .maybeSingle();
    if (error) setError(error.message);
    else setContent(data?.content ?? null);
  }, [key]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel(`dashboard_section_${key}_rt`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dashboard_sections", filter: `key=eq.${key}` },
        refresh,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, key]);

  return { content, loading, error, refresh };
}

export function useAllDashboardSections(keys: string[]) {
  const [sections, setSections] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from("dashboard_sections").select("*").in("key", keys);
    if (error) {
      setError(error.message);
    } else {
      const map: Record<string, unknown> = {};
      for (const row of data ?? []) {
        map[row.key] = row.content;
      }
      setSections(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join(",")]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard_sections_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dashboard_sections" },
        refresh,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { sections, loading, error, refresh };
}

export async function updateSection(password: string, key: string, content: unknown) {
  const { data, error } = await supabase.functions.invoke("dashboard-data", {
    body: { action: "update-section", password, key, content },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Failed to update section");
}
