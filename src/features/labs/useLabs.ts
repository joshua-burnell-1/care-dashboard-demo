// ABOUTME: Every lab reading the record holds (uploaded lab_results plus the medical cache) as one
// ABOUTME: merged list, for the Labs pages and the command palette.
import { useMemo } from "react";
import { useLabResults } from "@/hooks/useLabResults";
import { useMedicalCache } from "@/hooks/useMedicalCache";
import { mergeLabs, type LabResult } from "@/lib/labs";

export function useLabs(): { labs: LabResult[]; loading: boolean } {
  const { cache, loading: cacheLoading } = useMedicalCache();
  const { items: uploaded, loading: uploadsLoading } = useLabResults();
  const labs = useMemo(
    () => mergeLabs(uploaded, cache?.data?.lab_results ?? []),
    [cache, uploaded],
  );
  return { labs, loading: cacheLoading || uploadsLoading };
}
