// ABOUTME: A small pill that names a status in words with a colored dot: stable, watch, act or
// ABOUTME: neutral. Severity always travels as a label here, never as a red number.
import type { StatusLevel } from "@/lib/status";

export type ChipLevel = StatusLevel | "neutral";

const TINT: Record<ChipLevel, string> = {
  stable: "bg-stable/12 border-stable/25",
  watch: "bg-watch/14 border-watch/30",
  act: "bg-act/12 border-act/25",
  neutral: "bg-secondary border-line",
};

const DOT: Record<ChipLevel, string> = {
  stable: "bg-stable",
  watch: "bg-watch",
  act: "bg-act",
  neutral: "bg-muted",
};

export function StatusChip({
  level,
  label,
  size = "sm",
}: {
  level: ChipLevel;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      data-status={level}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium whitespace-nowrap text-ink ${TINT[level]} ${
        size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${DOT[level]}`} />
      {label}
    </span>
  );
}
