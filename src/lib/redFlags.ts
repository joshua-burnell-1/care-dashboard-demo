// ABOUTME: Splits the red-flag list into the three "when to call" tiers (emergency now, call the
// ABOUTME: care team today, mention at the next visit) using the prefix each title carries.
import type { TitledItem } from "@/features/shared/sections";

export type CallTier = "er" | "today" | "next";

const PREFIXES: [CallTier, RegExp][] = [
  ["er", /^go to the emergency department now:\s*/i],
  ["today", /^call the care team the same day:\s*/i],
  ["next", /^mention at the next visit:\s*/i],
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function groupRedFlags(flags: TitledItem[]): Record<CallTier, TitledItem[]> {
  const tiers: Record<CallTier, TitledItem[]> = { er: [], today: [], next: [] };
  for (const flag of flags) {
    const match = PREFIXES.find(([, re]) => re.test(flag.title));
    // A flag without a tier prefix is treated as a same-day call: the cautious default.
    const tier = match?.[0] ?? "today";
    const title = match ? flag.title.replace(match[1], "") : flag.title;
    tiers[tier].push({ title: capitalize(title), body: flag.body });
  }
  return tiers;
}
