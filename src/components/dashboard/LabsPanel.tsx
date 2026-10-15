import { useEffect, useMemo, useState } from "react";
import { useMedicalCache, type CacheLabResult } from "@/hooks/useMedicalCache";
import { useLabResults, type LabResult } from "@/hooks/useLabResults";
import { canonicalMetricKey, canonicalMetricLabel } from "@/lib/normalizeMetric";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { MascotLoader } from "@/components/MascotLoader";

// Adapt a lab_results row (from the uploads pipeline) to the CacheLabResult
// shape the rest of this component already renders. Upload rows carry the
// source label "upload" so a user can tell where a value came from.
function adaptUploadedLab(r: LabResult): CacheLabResult {
  const value: number | string | null =
    r.value_numeric !== null ? r.value_numeric : r.value_text !== null ? r.value_text : null;
  return {
    date: r.date ?? undefined,
    metric: r.metric,
    category: r.category ?? undefined,
    value,
    unit: r.unit || undefined,
    reference_range: r.reference_range ?? undefined,
    flag: r.flag ?? undefined,
    source: r.source || "upload",
    note: r.note || undefined,
  };
}

function fmtDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function flagTone(flag?: string): string {
  if (!flag) return "text-stone-700";
  const f = flag.toLowerCase();
  if (f.includes("high") || f.includes("h") || f.includes("abnormal") || f.includes("critical"))
    return "text-rose-700 font-semibold";
  if (f.includes("low") || f === "l") return "text-amber-700 font-semibold";
  if (f.includes("normal")) return "text-emerald-700";
  return "text-stone-700";
}

export function LabsPanel() {
  const { cache, loading } = useMedicalCache();
  const { items: uploadedRaw } = useLabResults();
  const [query, setQuery] = useState("");
  const [activeMetric, setActiveMetric] = useState<string>("all");
  const [trendMetric, setTrendMetric] = useState<string | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);

  useEffect(() => {
    setFilterLoading(true);
    const t = setTimeout(() => setFilterLoading(false), 900);
    return () => clearTimeout(t);
  }, [activeMetric]);

  const cacheLabs: CacheLabResult[] = cache?.data?.lab_results ?? [];
  const uploadedLabs: CacheLabResult[] = useMemo(
    () => uploadedRaw.map(adaptUploadedLab),
    [uploadedRaw],
  );

  // Merge order puts uploaded rows first so they win any (date, metric, value)
  // collision — those rows are the ones the user just approved, and they carry
  // a link back to the source document.
  const labs: CacheLabResult[] = useMemo(() => {
    const seen = new Set<string>();
    const merged: CacheLabResult[] = [];
    for (const l of [...uploadedLabs, ...cacheLabs] as CacheLabResult[]) {
      const key = `${l.date ?? ""}|${(l.metric ?? "").toLowerCase()}|${l.value ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(l);
    }
    return merged;
  }, [uploadedLabs, cacheLabs]);

  // Metric pill list: dedupe by canonical key, label with canonical display.
  // "MCH" and "Mean Cell Hemoglobin" collapse to one "MCH (Mean Cell Hemoglobin)"
  // pill; "Potassium" and "Potassium Level" collapse to one "Potassium" pill.
  const metricEntries = useMemo(() => {
    const byKey = new Map<string, string>();
    labs.forEach((l) => {
      if (!l.metric) return;
      byKey.set(canonicalMetricKey(l.metric), canonicalMetricLabel(l.metric));
    });
    return Array.from(byKey.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [labs]);

  const trendLabel = trendMetric ? canonicalMetricLabel(trendMetric) : null;

  const filtered = useMemo(() => {
    const activeKey = activeMetric === "all" ? "all" : canonicalMetricKey(activeMetric);
    return labs
      .filter((l) => activeKey === "all" || canonicalMetricKey(l.metric) === activeKey)
      .filter((l) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          l.metric?.toLowerCase().includes(q) ||
          canonicalMetricLabel(l.metric).toLowerCase().includes(q) ||
          l.category?.toLowerCase().includes(q) ||
          l.source?.toLowerCase().includes(q) ||
          l.note?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [labs, activeMetric, query]);

  const trendData = useMemo(() => {
    if (!trendMetric) return [];
    const target = canonicalMetricKey(trendMetric);
    return labs
      .filter((l) => canonicalMetricKey(l.metric) === target)
      .map((l) => ({
        date: l.date,
        label: l.date
          ? new Date(l.date).toLocaleDateString(undefined, { month: "short", year: "numeric" })
          : "",
        value: typeof l.value === "number" ? l.value : parseFloat(String(l.value)),
        unit: l.unit,
        flag: l.flag,
        note: l.note,
        variant: l.metric,
      }))
      .filter((p) => !isNaN(p.value))
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [labs, trendMetric]);

  const trendUnit = trendData[0]?.unit;

  if (loading && labs.length === 0) return <p className="text-sm text-stone-500">Loading…</p>;

  return (
    <div className="space-y-4">
      {trendMetric && (
        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-stone-500">Trend</p>
              <p className="font-medium text-stone-900 break-words">{trendLabel}</p>
              <p className="text-xs text-stone-500 mt-0.5">
                {trendData.length} reading{trendData.length === 1 ? "" : "s"}
                {trendUnit ? ` · ${trendUnit}` : ""}
              </p>
            </div>
            <button
              onClick={() => setTrendMetric(null)}
              className="text-xs px-2.5 py-1 rounded-full border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 shrink-0"
            >
              Close
            </button>
          </div>
          {trendData.length >= 1 ? (
            <div className="w-full h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 12, left: -10, bottom: 24 }}>
                  <CartesianGrid stroke="#f1f1ee" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#78716c" }}
                    label={{
                      value: "Month & Year",
                      position: "insideBottom",
                      offset: -12,
                      fontSize: 11,
                      fill: "#78716c",
                    }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#78716c" }} domain={[0, "auto"]} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e5e4" }}
                    labelFormatter={(_, payload) => {
                      const iso = (payload?.[0]?.payload as { date?: string } | undefined)?.date;
                      if (!iso) return "";
                      const d = new Date(iso);
                      if (isNaN(d.getTime())) return iso;
                      return d.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      });
                    }}
                    formatter={(v) =>
                      [`${v}${trendUnit ? ` ${trendUnit}` : ""}`, trendLabel ?? ""] as [
                        string,
                        string,
                      ]
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#991b1b"
                    strokeWidth={2.5}
                    dot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-stone-500">No numeric readings on file yet.</p>
          )}
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by metric, category, source…"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
        {metricEntries.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={activeMetric === "all"} onClick={() => setActiveMetric("all")}>
              All metrics
            </FilterPill>
            {metricEntries.map(([key, label]) => (
              <FilterPill
                key={key}
                active={activeMetric !== "all" && canonicalMetricKey(activeMetric) === key}
                onClick={() => {
                  setActiveMetric(label);
                  setTrendMetric(label);
                }}
              >
                {label}
              </FilterPill>
            ))}
          </div>
        )}
        <p className="text-xs text-stone-500">
          Showing {filtered.length} of {labs.length} result{labs.length === 1 ? "" : "s"}
        </p>
      </div>

      {filterLoading ? (
        <div className="bg-white border border-stone-200 rounded-2xl">
          <MascotLoader label="Loading results…" />
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl divide-y divide-stone-100">
          {filtered.map((l, i) => (
            <button
              key={i}
              onClick={() => l.metric && setTrendMetric(canonicalMetricLabel(l.metric))}
              className="w-full text-left p-3 sm:p-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 hover:bg-stone-50 transition"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-stone-900 break-words">
                  {canonicalMetricLabel(l.metric)}
                </p>
                <p className="text-xs text-stone-500 mt-0.5 break-words">
                  {l.category && <span>{l.category}</span>}
                  {l.category && l.source ? " · " : ""}
                  {l.source && <span>{l.source}</span>}
                  {l.reference_range ? ` · ref ${l.reference_range}` : ""}
                </p>
                {l.note && <p className="text-xs text-stone-500 mt-1 break-words">{l.note}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className={`text-base ${flagTone(l.flag)}`}>
                  {l.value ?? "—"}
                  {l.unit ? <span className="text-xs text-stone-500 ml-1">{l.unit}</span> : null}
                </p>
                <p className="text-[11px] text-stone-400 mt-0.5">{fmtDate(l.date)}</p>
                {l.flag && (
                  <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-0.5">
                    {l.flag}
                  </p>
                )}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="p-4 text-sm text-stone-500">No results match those filters.</p>
          )}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition ${
        active
          ? "bg-stone-900 text-white border-stone-900"
          : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
      }`}
    >
      {children}
    </button>
  );
}
