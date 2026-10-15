// ABOUTME: The red flags as three tiers side by side (ER now, call today, mention at the next
// ABOUTME: visit), each listing its signs; "See all" expands every sign with its explanation in place.
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { StatusChip, type ChipLevel } from "@/components/StatusChip";
import type { TitledItem } from "@/features/shared/sections";
import { groupRedFlags, type CallTier } from "@/lib/redFlags";

const TIERS: { tier: CallTier; label: string; level: ChipLevel; hint: string }[] = [
  { tier: "er", label: "ER now", level: "act", hint: "Go to the emergency department" },
  { tier: "today", label: "Call today", level: "watch", hint: "Call the care team the same day" },
  { tier: "next", label: "Next visit", level: "neutral", hint: "Mention it at the next visit" },
];

export function WhenToCall({ redFlags }: { redFlags: TitledItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const tiers = groupRedFlags(redFlags);
  if (redFlags.length === 0) return null;

  return (
    <section
      aria-labelledby="when-to-call-heading"
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id="when-to-call-heading" className="font-display text-3xl text-ink">
            When to call
          </h2>
          <p className="mt-1 text-sm text-muted">If a new symptom shows up, this is who to call.</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {expanded ? "Show less" : "See all"}
          <ChevronDown
            size={16}
            aria-hidden
            className={`transition-transform duration-200 ease-out ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      <div
        id={panelId}
        className="mt-5 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3"
      >
        {TIERS.map(({ tier, label, level, hint }) => (
          <div key={tier} data-tier={tier} className="bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <StatusChip level={level} label={label} />
              <span className="text-xs text-muted tabular-nums">
                {tiers[tier].length} sign{tiers[tier].length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">{hint}</p>
            <ul className="mt-3 space-y-2">
              {tiers[tier].map((flag) => (
                <li key={flag.title} className="text-sm">
                  <p className="font-medium text-ink">{flag.title}</p>
                  {expanded && <p className="mt-0.5 leading-relaxed text-muted">{flag.body}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
