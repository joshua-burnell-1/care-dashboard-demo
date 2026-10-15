// ABOUTME: The one source of human sentences for edit history: describeEdit names what changed and
// ABOUTME: whose it was, plus the Activity page's day groups and human table filters.
import type { EditHistoryEntry } from "@/hooks/useEditHistory";
import { formatDate, formatRelative } from "./format";
import { PSA_PHASE_LABELS } from "./status";

type Row = Record<string, unknown>;

export type EditDescription = {
  title: string;
  detail?: string;
  icon: "add" | "edit" | "delete";
};

/** Dashboard sections by key, as a sentence names them. */
export const SECTION_NAMES: Record<string, string> = {
  summary: "the summary",
  red_flags: "the red flags",
  open_questions: "the open questions",
  patient: "the patient details",
  doctors: "the doctors' views",
  agreements: "where the doctors agree",
  disagreements: "where the doctors differ",
  decision_tree: "the decision tree",
};

/** Columns that change on every write, or carry no meaning for people. */
const IGNORED = new Set(["id", "key", "created_at", "updated_at", "uploaded_at", "sort_index"]);

/** Column names in words, per table. A column missing here is never named. */
const FIELD_NAMES: Record<string, Record<string, string>> = {
  medication_items: { item: "name", dose: "dose", purpose: "purpose", started_by: "prescriber" },
  care_team_members: {
    name: "name",
    role: "role",
    where_based: "location",
    note: "notes",
    phone: "phone number",
    email: "email",
  },
  plan_items: { title: "title", event_date: "date", status: "status", body: "notes" },
  psa_readings: { date: "date", value: "value", unit: "unit", phase: "phase", note: "note" },
  kpi_cards: { label: "label", value: "value", sub: "caption", tone: "color" },
  lab_results: {
    metric: "name",
    date: "date",
    value_numeric: "value",
    value_text: "value",
    unit: "unit",
    reference_range: "reference range",
    flag: "flag",
    note: "note",
    category: "panel",
  },
  dashboard_sections: { content: "content" },
  documents: { name: "name", status: "status" },
};

/** Free text that reads better as an excerpt of the new wording than as "old to new". */
const LONG_TEXT = new Set(["note", "body", "purpose", "where_based"]);
const DATE_FIELDS = new Set(["date", "event_date"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const MAX_VALUE = 60;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const clip = (s: string, max = MAX_VALUE) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "a", "a and b", "a, b and c". */
function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** "Dr. Jane Smith's", "Dr. Helen Brooks'", and a trailing credential (", RN") dropped first. */
export function possessive(name: string): string {
  const bare = name.replace(/,\s*[A-Z][A-Za-z.]*$/, "").trim();
  return bare.endsWith("s") ? `${bare}'` : `${bare}'s`;
}

/** A stored value in words: dates formatted, PSA phases named, arrays and objects skipped. */
function showValue(table: string, field: string, value: unknown, row: Row): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    const unit = table === "psa_readings" && field === "value" ? str(row.unit) : "";
    return unit ? `${value} ${unit}` : String(value);
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (DATE_FIELDS.has(field) || ISO_DATE.test(text)) return text ? formatDate(text) : "";
  if (table === "psa_readings" && field === "phase") return PSA_PHASE_LABELS[text] ?? text;
  return clip(text);
}

/** The columns an update changed that people would recognise, in the table's field order. */
function changedFields(table: string, oldRow: Row, newRow: Row): string[] {
  const names = FIELD_NAMES[table] ?? {};
  return Object.keys(names).filter(
    (k) => !IGNORED.has(k) && JSON.stringify(oldRow[k]) !== JSON.stringify(newRow[k]),
  );
}

/** "Oct 21, 2026 to Oct 28, 2026", "Set to x", "Cleared (was x)", or an excerpt for long text. */
function diffDetail(table: string, field: string, oldRow: Row, newRow: Row): string | undefined {
  const before = showValue(table, field, oldRow[field], oldRow);
  const after = showValue(table, field, newRow[field], newRow);
  if (LONG_TEXT.has(field)) return after ? clip(after, 80) : before ? "Cleared" : undefined;
  if (!before && !after) return undefined;
  if (!before) return `Set to ${after}`;
  if (!after) return `Cleared (was ${before})`;
  // PSA values share a unit, so it is said once: "0.1 to 0.11 ng/mL".
  if (table === "psa_readings" && field === "value") {
    return `${String(oldRow[field])} to ${after}`;
  }
  return `${before} to ${after}`;
}

type Phrases = {
  /** The record as a noun phrase, e.g. "Vitamin D3" or "the PSA reading from Oct 6, 2026". */
  subject: string;
  added: string;
  removed: string;
  /** Detail under an add or a remove. */
  summary?: string;
  /** Title for an update that changed one field, given the field and both rows. */
  changed: (field: string, words: string, oldRow: Row, newRow: Row) => string;
  /** Title for an update that changed several fields (or none worth naming). */
  updated: string;
};

/** `row` is the record after the change (before it, for a removal). */
function phrasesFor(table: string, row: Row, recordId: string): Phrases {
  switch (table) {
    case "medication_items": {
      const name = str(row.item) || "a medication";
      return {
        subject: name,
        added: `Added medication: ${name}`,
        removed: `Removed medication: ${name}`,
        summary: clip(str(row.dose)) || undefined,
        changed: (field, words, o, n) =>
          field === "item"
            ? `Renamed ${str(o.item) || "a medication"} to ${str(n.item) || "a medication"}`
            : field === "started_by"
              ? `Changed who started ${name}`
              : `Changed ${name} ${words}`,
        updated: `Updated ${name}`,
      };
    }
    case "care_team_members": {
      const name = str(row.name);
      const whose = name ? possessive(name) : "a care team member's";
      return {
        subject: name || "a care team member",
        added: `Added ${name || "a member"} to the care team`,
        removed: `Removed ${name || "a member"} from the care team`,
        summary: clip(str(row.role)) || undefined,
        changed: (field, words, o, n) =>
          field === "name"
            ? `Renamed ${str(o.name) || "a care team member"} to ${str(n.name) || "a care team member"}`
            : `Updated ${whose} ${words}`,
        updated: `Updated ${whose} details`,
      };
    }
    case "plan_items": {
      const title = str(row.title) || "a plan item";
      return {
        subject: title,
        added: `Added plan item: ${title}`,
        removed: `Removed plan item: ${title}`,
        summary: str(row.event_date) ? formatDate(str(row.event_date)) : undefined,
        changed: (field) => {
          if (field === "title") return `Renamed plan item: ${title}`;
          if (field === "event_date") return `Moved ${title}`;
          if (field === "status") return `Changed the status of ${title}`;
          return `Updated the notes for ${title}`;
        },
        updated: `Updated plan item: ${title}`,
      };
    }
    case "psa_readings": {
      const day = str(row.date) ? formatDate(str(row.date)) : "";
      const subject = day ? `the PSA reading from ${day}` : "a PSA reading";
      const value = typeof row.value === "number" ? `${row.value} ${str(row.unit)}`.trim() : "";
      return {
        subject,
        added: value ? `Added a PSA reading: ${value}` : "Added a scheduled PSA draw",
        removed: `Removed ${subject}`,
        summary: day || undefined,
        changed: (field) => {
          if (field === "date")
            return day ? `Moved a PSA reading to ${day}` : "Moved a PSA reading";
          if (field === "value") return `Changed ${subject}`;
          if (field === "note") return `Updated the note on ${subject}`;
          return `Changed the ${FIELD_NAMES.psa_readings[field]} of ${subject}`;
        },
        updated: `Updated ${subject}`,
      };
    }
    case "kpi_cards": {
      const label = str(row.label) || "a key number";
      return {
        subject: label,
        added: `Added key number: ${label}`,
        removed: `Removed key number: ${label}`,
        summary: clip(str(row.value)) || undefined,
        changed: () => `Updated key number: ${label}`,
        updated: `Updated key number: ${label}`,
      };
    }
    case "dashboard_sections": {
      const key = str(row.key) || recordId;
      const name =
        SECTION_NAMES[key] ?? (key ? `the ${key.replace(/_/g, " ")} notes` : "the notes");
      return {
        subject: name,
        added: `Added ${name}`,
        removed: `Removed ${name}`,
        changed: () => `Updated ${name}`,
        updated: `Updated ${name}`,
      };
    }
    case "lab_results": {
      const metric = str(row.metric) || "a lab result";
      const value = row.value_numeric ?? row.value_text;
      return {
        subject: metric,
        added: `Added lab result: ${metric}`,
        removed: `Removed lab result: ${metric}`,
        summary:
          value === null || value === undefined
            ? undefined
            : `${String(value)} ${str(row.unit)}`.trim(),
        changed: () => `Updated lab result: ${metric}`,
        updated: `Updated lab result: ${metric}`,
      };
    }
    case "documents": {
      const name = str(row.name) || "a document";
      return {
        subject: name,
        added: `Added document: ${name}`,
        removed: `Removed document: ${name}`,
        changed: () => `Updated document: ${name}`,
        updated: `Updated document: ${name}`,
      };
    }
    default:
      return {
        subject: "a record",
        added: "Added a record",
        removed: "Removed a record",
        changed: () => "Updated a record",
        updated: "Updated a record",
      };
  }
}

/** One edit_history row as a sentence a family member would say, with an optional second line. */
export function describeEdit(entry: EditHistoryEntry): EditDescription {
  const oldRow = entry.old_data ?? {};
  const newRow = entry.new_data ?? {};
  const table = entry.table_name;
  const phrases = phrasesFor(
    table,
    entry.operation === "DELETE" ? oldRow : newRow,
    entry.record_id,
  );

  if (entry.operation === "INSERT") {
    return { title: phrases.added, detail: phrases.summary, icon: "add" };
  }
  if (entry.operation === "DELETE") {
    return { title: phrases.removed, detail: phrases.summary, icon: "delete" };
  }

  const fields = changedFields(table, oldRow, newRow);
  const names = FIELD_NAMES[table] ?? {};
  if (fields.length === 1) {
    const [field] = fields;
    return {
      title: phrases.changed(field, names[field], oldRow, newRow),
      detail: diffDetail(table, field, oldRow, newRow),
      icon: "edit",
    };
  }
  // Two columns can share a name (a lab value is numeric or text), so say each name once.
  const words = [...new Set(fields.map((f) => names[f]))];
  return {
    title: phrases.updated,
    detail: words.length ? `Changed the ${listWords(words)}` : undefined,
    icon: "edit",
  };
}

/**
 * Whether a log entry can still be undone, judged from the log itself:
 * - `available`: the record still reads as this change left it (nothing since, or every later
 *   change was reverted).
 * - `undone`: the record is back to how it was before this change.
 * - `removed-since`: the record was deleted later.
 * - `changed-since`: a later change that is not a revert of this one; undo that first.
 * - `unavailable`: there is nothing to put back (an update logged without its old row).
 */
export type UndoState = "available" | "undone" | "removed-since" | "changed-since" | "unavailable";

export type EntryUndo = {
  state: UndoState;
  /** This entry puts the record back the way it was before the previous change to it. */
  reverts: boolean;
};

/** The fields two snapshots of a record are compared on: what people see, not timestamps. */
function sameRecord(table: string, a: Row | null, b: Row | null): boolean {
  if (a === null || b === null) return a === b;
  const named = FIELD_NAMES[table];
  const keys = named
    ? Object.keys(named)
    : [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !IGNORED.has(k));
  return keys.every((k) => JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null));
}

/** Undo state for every entry, from the log newest first (as the Activity page reads it). */
export function undoStates(entries: EditHistoryEntry[]): Map<string, EntryUndo> {
  const result = new Map<string, EntryUndo>();
  // Entries per record, newest first.
  const byRecord = new Map<string, EditHistoryEntry[]>();
  for (const e of entries) {
    const key = `${e.table_name}:${e.record_id}`;
    byRecord.set(key, [...(byRecord.get(key) ?? []), e]);
  }
  for (const history of byRecord.values()) {
    const current = history[0];
    history.forEach((e, i) => {
      const table = e.table_name;
      const previous = history[i + 1];
      const reverts =
        !!previous &&
        sameRecord(table, e.new_data, previous.old_data) &&
        sameRecord(table, e.old_data, previous.new_data);
      let state: UndoState;
      if (e.operation === "UPDATE" && e.old_data === null) state = "unavailable";
      else if (i === 0 || sameRecord(table, current.new_data, e.new_data)) state = "available";
      else if (sameRecord(table, current.new_data, e.old_data)) state = "undone";
      else if (current.operation === "DELETE") state = "removed-since";
      else state = "changed-since";
      result.set(e.id, { state, reverts });
    });
  }
  return result;
}

/** The Activity filter: a human name for one area of the record and the tables it covers. */
export type ActivityFilter = { value: string; label: string; tables: string[] };

export const ACTIVITY_FILTERS: ActivityFilter[] = [
  { value: "plan", label: "Plan", tables: ["plan_items"] },
  { value: "labs", label: "Labs", tables: ["psa_readings", "lab_results"] },
  { value: "team", label: "Team", tables: ["care_team_members"] },
  { value: "medications", label: "Medications", tables: ["medication_items"] },
  { value: "documents", label: "Documents", tables: ["documents"] },
  { value: "notes", label: "Notes", tables: ["dashboard_sections"] },
  { value: "key-numbers", label: "Key numbers", tables: ["kpi_cards"] },
];

export function filterForTable(table: string): ActivityFilter | undefined {
  return ACTIVITY_FILTERS.find((f) => f.tables.includes(table));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The local calendar day of a timestamp, as `YYYY-MM-DD`. */
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type DayGroup = { key: string; label: string; entries: EditHistoryEntry[] };

/** Entries (newest first) in runs by local day: "Today", "Yesterday", then the date. */
export function groupByDay(entries: EditHistoryEntry[], now: Date = new Date()): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const e of entries) {
    const key = localDay(e.changed_at);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      const relative = formatRelative(key, now);
      const label =
        relative === "today" || relative === "yesterday" ? capitalize(relative) : formatDate(key);
      group = { key, label, entries: [] };
      groups.push(group);
    }
    group.entries.push(e);
  }
  return groups;
}
