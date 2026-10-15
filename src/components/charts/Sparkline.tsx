// ABOUTME: A tiny trend line for a stat tile: the values in the data color, oldest to newest, with
// ABOUTME: the latest point marked (in the status color when one is given). Decorative only.
import type { StatusLevel } from "@/lib/status";

const DOT_FILL: Record<StatusLevel, string> = {
  stable: "var(--stable)",
  watch: "var(--watch)",
  act: "var(--act)",
};

export function Sparkline({
  values,
  status,
  width = 104,
  height = 36,
}: {
  values: number[];
  status?: StatusLevel;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const inset = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [
    inset + (i / (values.length - 1)) * (width - inset * 2),
    height - inset - ((v - min) / range) * (height - inset * 2),
  ]);
  const [lastX, lastY] = pts[pts.length - 1];
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible"
    >
      <polyline
        points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke="var(--data)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastX}
        cy={lastY}
        r={3.5}
        fill={status ? DOT_FILL[status] : "var(--data)"}
        stroke="var(--surface)"
        strokeWidth={2}
      />
    </svg>
  );
}
