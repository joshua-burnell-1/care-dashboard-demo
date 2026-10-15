// ABOUTME: "What changed" since the last plan item: new PSA results, lab panels, documents and the
// ABOUTME: family's edits as linkable items, newest first, plus the table names edit history shows.
import type { Document } from "@/hooks/useDocuments";
import type { EditHistoryEntry } from "@/hooks/useEditHistory";
import type { LabResult } from "@/hooks/useLabResults";
import type { PsaReading } from "@/hooks/usePsaReadings";
import { labMetricSlug } from "./labs";
import { canonicalMetricKey } from "./normalizeMetric";
import { formatPsa } from "./status";

export type ChangeItem = {
  id: string;
  kind: "lab" | "psa" | "document" | "edit";
  title: string;
  detail?: string;
  /** ISO date or timestamp the change happened. */
  date: string;
  /** Where the item links. */
  to: string;
};

const TABLE_LABELS: Record<string, string> = {
  psa_readings: "PSA reading",
  care_team_members: "Care team",
  medication_items: "Medication",
  kpi_cards: "KPI card",
  plan_items: "Plan item",
  dashboard_sections: "Dashboard section",
};

export function tableLabel(name: string): string {
  return TABLE_LABELS[name] ?? name;
}

const VERBS: Record<EditHistoryEntry["operation"], string> = {
  INSERT: "added",
  UPDATE: "updated",
  DELETE: "deleted",
};

/** The name a row goes by, for naming a single edit. */
function rowName(entry: EditHistoryEntry): string | undefined {
  const row = entry.new_data ?? entry.old_data ?? {};
  for (const key of ["title", "item", "name", "label", "metric"]) {
    if (typeof row[key] === "string" && row[key]) return row[key] as string;
  }
  return undefined;
}

const day = (iso: string) => iso.slice(0, 10);

function psaChanges(sinceIso: string, psa: PsaReading[]): ChangeItem[] {
  const valued = psa
    .filter((r): r is PsaReading & { value: number } => r.value != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  return valued.flatMap((r, i) => {
    if (day(r.date) < sinceIso) return [];
    const prev = valued[i - 1]?.value;
    const detail =
      prev == null
        ? undefined
        : `${r.value > prev ? "Up" : r.value < prev ? "Down" : "Unchanged"} from ${formatPsa(prev)}`;
    return [
      {
        id: `psa-${r.id}`,
        kind: "psa" as const,
        title: `New PSA: ${formatPsa(r.value)} ${r.unit}`,
        detail,
        date: r.date,
        to: "/labs/psa",
      },
    ];
  });
}

function labChanges(sinceIso: string, labs: LabResult[]): ChangeItem[] {
  // PSA rows mirror psa_readings, which already have their own item.
  const byDay = new Map<string, LabResult[]>();
  for (const l of labs) {
    if (!l.date || day(l.date) < sinceIso) continue;
    if (canonicalMetricKey(l.metric).startsWith("psa")) continue;
    byDay.set(day(l.date), [...(byDay.get(day(l.date)) ?? []), l]);
  }
  return [...byDay].map(([date, results]) => {
    const flagged = results.filter((r) => r.flag).length;
    return {
      id: `lab-${date}`,
      kind: "lab" as const,
      title:
        results.length === 1
          ? `New lab result: ${results[0].metric}`
          : `New lab results: ${results.length} tests`,
      detail: flagged ? `${flagged} outside the reference range` : "All within the reference range",
      date,
      to: results.length === 1 ? `/labs/${labMetricSlug(results[0].metric)}` : "/labs",
    };
  });
}

function documentChanges(sinceIso: string, documents: Document[]): ChangeItem[] {
  return documents
    .filter((d) => day(d.uploaded_at) >= sinceIso)
    .map((d) => ({
      id: `document-${d.id}`,
      kind: "document" as const,
      title: `Document added: ${d.name}`,
      date: d.uploaded_at,
      to: `/documents/${d.id}`,
    }));
}

/** The family's edits fold into one item, so a busy week of edits never hides a new result. */
function editChanges(sinceIso: string, edits: EditHistoryEntry[]): ChangeItem[] {
  const recent = edits
    .filter((e) => day(e.changed_at) >= sinceIso)
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at));
  if (recent.length === 0) return [];
  if (recent.length === 1) {
    const [e] = recent;
    return [
      {
        id: `edit-${e.id}`,
        kind: "edit",
        title: `${tableLabel(e.table_name)} ${VERBS[e.operation]}`,
        detail: rowName(e),
        date: e.changed_at,
        to: "/activity",
      },
    ];
  }
  const tables = [...new Set(recent.map((e) => tableLabel(e.table_name)))];
  return [
    {
      id: "edits",
      kind: "edit",
      title: `${recent.length} edits to the record`,
      detail: tables.join(", "),
      date: recent[0].changed_at,
      to: "/activity",
    },
  ];
}

/** Everything on or after `sinceIso` (a `YYYY-MM-DD` day), newest first. */
export function changesSince(
  sinceIso: string,
  data: {
    edits: EditHistoryEntry[];
    documents: Document[];
    labs: LabResult[];
    psa: PsaReading[];
  },
): ChangeItem[] {
  const since = day(sinceIso);
  return [
    ...editChanges(since, data.edits),
    ...documentChanges(since, data.documents),
    ...psaChanges(since, data.psa),
    ...labChanges(since, data.labs),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Where "what changed" starts: the most recent plan item dated before today, or 30 days ago
 * when there is none. `todayIso` is today's local `YYYY-MM-DD`.
 */
export function changeWindowStart(
  planItems: { event_date: string | null; title: string }[],
  todayIso: string,
): { date: string; label: string | null } {
  const past = planItems
    .filter(
      (p): p is typeof p & { event_date: string } => !!p.event_date && p.event_date < todayIso,
    )
    .sort((a, b) => b.event_date.localeCompare(a.event_date))[0];
  if (past) return { date: day(past.event_date), label: past.title };
  const [y, m, d] = todayIso.split("-").map(Number);
  const back = new Date(y, m - 1, d - 30);
  return {
    date: `${back.getFullYear()}-${pad(back.getMonth() + 1)}-${pad(back.getDate())}`,
    label: null,
  };
}
