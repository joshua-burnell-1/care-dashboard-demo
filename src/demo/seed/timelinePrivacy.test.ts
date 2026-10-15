// ABOUTME: Regression guard: the demo's milestone dates must not land on a date in the private
// ABOUTME: denylist for any "today" in the 120 days after publication. Skipped when no denylist exists (CI).
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { buildSeed } from "./index";
import { TIMELINE } from "../persona";
import { formatLongDate, isoDaysFromToday } from "../dates";

const DENYLIST_PATH = process.env.PII_DENYLIST ?? "/home/user/scrub/denylist.txt";
const HORIZON_DAYS = 120;
const STEP_DAYS = 7;
/**
 * The window starts at the publication date, not at the run date, so the result is the same
 * on every run: the private calendar is dense enough that a window sliding with the run date
 * would hit chance single-day coincidences on some days and not on others.
 */
const PUBLICATION_DATE = new Date(2026, 9, 14, 12);

const collapse = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Day-precise formats only. The denylist also lists the months of the whole real course of
 * care, so a month-level check ("Month YYYY", "Mon YYYY") would reject every timeline that
 * overlaps it, including one that is clearly shifted away from the real milestones.
 */
const FORMATS: Record<string, (iso: string) => string> = {
  ISO: (iso) => iso,
  "Month D, YYYY": formatLongDate,
};

function milestones(today: Date): Record<string, string> {
  const firstRise = buildSeed(today).psa_readings.find((r) => r.phase === "post-rad")!;
  return {
    surgery: isoDaysFromToday(TIMELINE.surgery, today),
    radiationStart: isoDaysFromToday(TIMELINE.radiationStart, today),
    radiationEnd: isoDaysFromToday(TIMELINE.radiationEnd, today),
    firstRise: firstRise.date,
  };
}

describe.skipIf(!existsSync(DENYLIST_PATH))("demo timeline vs the private denylist", () => {
  it(`no milestone date matches a denylist entry for ${HORIZON_DAYS} days after publication`, () => {
    const entries = readFileSync(DENYLIST_PATH, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"))
      .map(collapse);
    expect(entries.length).toBeGreaterThan(0);

    // Only the milestone kind, the format name and the day offset are reported: never a date or an entry.
    const failures: string[] = [];
    const start = PUBLICATION_DATE;
    for (let offset = 0; offset <= HORIZON_DAYS; offset += STEP_DAYS) {
      const today = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset, 12);
      for (const [kind, iso] of Object.entries(milestones(today))) {
        for (const [format, render] of Object.entries(FORMATS)) {
          const text = collapse(render(iso));
          if (entries.some((e) => e.includes(text) || text.includes(e))) {
            failures.push(`${kind} as ${format} at today+${offset}d`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
