import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { PsaReading } from "@/hooks/usePsaReadings";

type View = "all" | "post-op" | "post-rad";

function shortLabel(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type ChartPoint = {
  date: string;
  label: string;
  value: number | null;
  phase: string;
  note: string;
};

function toChartPoints(readings: PsaReading[]): ChartPoint[] {
  return readings.map((r) => ({
    date: r.date,
    label: shortLabel(r.date),
    value: r.value,
    phase: r.phase,
    note: r.note || "",
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(props: any) {
  const { cx, cy, payload, index, data } = props;
  if (payload.value === null || cy === undefined) return null;
  const isLatest = index === data.length - 1 || data[index + 1]?.value === null;
  return (
    <g>
      {isLatest && <circle cx={cx} cy={cy} r={8} fill="#0d9488" fillOpacity={0.15} />}
      <circle
        cx={cx}
        cy={cy}
        r={isLatest ? 5 : 3.5}
        fill="#0d9488"
        stroke="white"
        strokeWidth={isLatest ? 2 : 1.5}
      />
    </g>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as ChartPoint;
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-lg px-3 py-2.5 text-xs max-w-[200px]">
      <p className="font-semibold text-stone-900">{label}</p>
      {p.value !== null && <p className="text-teal-700 font-medium mt-0.5">{p.value} ng/mL</p>}
      {p.note && <p className="text-stone-500 mt-0.5 leading-relaxed">{p.note}</p>}
    </div>
  );
}

/** True when the viewer asked the OS for less motion; the chart then draws without animating. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export function PsaChart({ dbPsa = [] }: { dbPsa?: PsaReading[] }) {
  const [view, setView] = useState<View>("post-op");
  const [reduceMotion] = useState(prefersReducedMotion);

  const data = useMemo(() => {
    const points = toChartPoints(dbPsa);
    return points.filter((p) =>
      view === "all" ? true : view === "post-op" ? p.phase !== "pre-op" : p.phase === "post-rad",
    );
  }, [dbPsa, view]);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(
          [
            ["all", "Full history"],
            ["post-op", "Post-surgery"],
            ["post-rad", "Post-radiation"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`text-xs px-3 py-1.5 rounded-full border transition font-medium ${
              view === k
                ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                : "bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="w-full h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 28, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="psaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d9488" stopOpacity={0.18} />
                <stop offset="85%" stopColor="#0d9488" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f5f4f2" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#a8a29e" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#a8a29e" }}
              axisLine={false}
              tickLine={false}
              domain={[0, "auto"]}
            />
            <Tooltip content={<CustomTooltip />} />
            {view !== "all" && (
              <ReferenceLine
                y={0.2}
                ifOverflow="extendDomain"
                stroke="#64748b"
                strokeDasharray="4 3"
                strokeOpacity={0.6}
                label={{ value: "0.20", fill: "#64748b", fontSize: 9, position: "right" }}
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke="#0d9488"
              strokeWidth={2.5}
              fill="url(#psaGradient)"
              dot={<CustomDot data={data} />}
              activeDot={false}
              connectNulls
              isAnimationActive={!reduceMotion}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-stone-400 mt-3 leading-relaxed">
        — — 0.20 scan readiness line
      </p>
    </div>
  );
}
