// ABOUTME: Every lab metric the record holds (medical cache plus uploaded lab_results), grouped
// ABOUTME: by canonical name with a URL slug, for the /labs/$metric page. Task 5 replaces it.
import { useMemo } from "react";
import { useMedicalCache } from "@/hooks/useMedicalCache";
import { useLabResults } from "@/hooks/useLabResults";
import { labMetricSlug } from "@/lib/labs";
import { canonicalMetricLabel } from "@/lib/normalizeMetric";

export type LabReading = {
  date?: string;
  value: number | string | null;
  unit?: string;
  flag?: string;
  source?: string;
};

export type LabMetric = { slug: string; name: string; readings: LabReading[] };

export function useLabMetrics(): { metrics: LabMetric[]; loading: boolean } {
  const { cache, loading: cacheLoading } = useMedicalCache();
  const { items: uploaded, loading: uploadsLoading } = useLabResults();

  const metrics = useMemo(() => {
    const rows: (LabReading & { metric: string })[] = [
      ...uploaded.map((r) => ({
        metric: r.metric,
        date: r.date ?? undefined,
        value: r.value_numeric ?? r.value_text,
        unit: r.unit || undefined,
        flag: r.flag ?? undefined,
        source: r.source || "upload",
      })),
      ...(cache?.data?.lab_results ?? []),
    ];
    const bySlug = new Map<string, LabMetric>();
    for (const { metric, ...reading } of rows) {
      if (!metric) continue;
      const slug = labMetricSlug(metric);
      if (!slug) continue;
      const entry = bySlug.get(slug) ?? { slug, name: canonicalMetricLabel(metric), readings: [] };
      entry.readings.push(reading);
      bySlug.set(slug, entry);
    }
    for (const m of bySlug.values()) {
      m.readings.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    }
    return [...bySlug.values()];
  }, [cache, uploaded]);

  return { metrics, loading: cacheLoading || uploadsLoading };
}
