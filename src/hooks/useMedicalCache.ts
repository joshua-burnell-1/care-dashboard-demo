import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CacheSource = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  textChars: number;
  truncated: boolean;
  error?: string;
};

export type CachePsaPoint = {
  date: string;
  label?: string;
  value: number | null;
  unit?: string;
  note?: string;
};

export type CacheCareTeam = {
  role?: string;
  name: string;
  where?: string;
  note?: string;
};

export type CacheKeyUpdate = {
  date?: string;
  title: string;
  body?: string;
};

export type CacheLabResult = {
  date?: string;
  metric: string;
  category?: string;
  value: number | string | null;
  unit?: string;
  reference_range?: string;
  flag?: string;
  source?: string;
  note?: string;
};

export type MedicalCacheData = {
  patient_summary?: string;
  headline?: string;
  latest_psa?: { value?: number | null; unit?: string; date?: string; note?: string };
  psa_history?: CachePsaPoint[];
  next_steps?: string[];
  care_team?: CacheCareTeam[];
  key_updates?: CacheKeyUpdate[];
  lab_results?: CacheLabResult[];
};

export type MedicalCacheRow = {
  id: number;
  data: MedicalCacheData;
  context: string;
  sources: CacheSource[];
  last_synced_at: string;
  last_error: string | null;
};

export function useMedicalCache() {
  const [cache, setCache] = useState<MedicalCacheRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("medical_cache")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (!error && data) setCache(data as unknown as MedicalCacheRow);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channelName = `medical_cache_${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "medical_cache" }, () =>
        refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { cache, loading, refresh };
}
